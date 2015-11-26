import browserify from 'browserify';
import browserSync from 'browser-sync';
import del from 'del';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import nunjucks from 'nunjucks';
import mkdirp from 'mkdirp';
import gulp from 'gulp';
import igdeploy from 'igdeploy';
import mergeStream from 'merge-stream';
import path from 'path';
import runSequence from 'run-sequence';
import source from 'vinyl-source-stream';
import subdir from 'subdir';
import vinylBuffer from 'vinyl-buffer';
import watchify from 'watchify';
import processData from './process-data.js';
const $ = require('auto-plug')('gulp');

dotenv.load();

const AUTOPREFIXER_BROWSERS = [
  'ie >= 8',
  'ff >= 30',
  'chrome >= 34',
];

const DEPLOY_TARGET = ''; // e.g. 'features/YOUR-PROJECT-NAME'

const BROWSERIFY_ENTRIES = [
  'scripts/main.js',
];

const BROWSERIFY_TRANSFORMS = [
  'babelify',
  'debowerify',
];

const OTHER_SCRIPTS = [
  'scripts/top.js'
];

let env = 'development';

// function to get an array of objects that handle browserifying
function getBundlers(useWatchify) {
  return BROWSERIFY_ENTRIES.map(entry => {
    var bundler = {
      b: browserify(path.posix.resolve('client', entry), {
        cache: {},
        packageCache: {},
        fullPaths: useWatchify,
        debug: useWatchify
      }),

      execute: function () {
        var stream = this.b.bundle()
          .on('error', $.util.log.bind($.util, 'Browserify error'))
          .pipe(source(entry.replace(/\.js$/, '.bundle.js')));

        // skip sourcemap creation if we're in 'serve' mode
        if (useWatchify) {
          stream = stream
            .pipe(vinylBuffer())
            .pipe($.sourcemaps.init({loadMaps: true}))
            .pipe($.sourcemaps.write('./'));
        }

        return stream.pipe(gulp.dest('.tmp'));
      }
    };

    // register all the transforms
    BROWSERIFY_TRANSFORMS.forEach(function (transform) {
      bundler.b.transform(transform);
    });

    // upgrade to watchify if we're in 'serve' mode
    if (useWatchify) {
      bundler.b = watchify(bundler.b);
      bundler.b.on('update', function (files) {
        // re-run the bundler then reload the browser
        bundler.execute().on('end', browserSync.reload);

        // also report any linting errors in the changed file(s)
        gulp.src(files.filter(file => subdir(path.resolve('client'), file))) // skip bower/npm modules
          .pipe($.eslint())
          .pipe($.eslint.format());
      });
    }

    return bundler;
  });
}

// compresses images (client => dist)
gulp.task('images', () => gulp.src('client/**/*.{jpg,png,gif,svg}')
  .pipe($.imagemin({
    progressive: true,
    interlaced: true,
  }))
  .pipe(gulp.dest('dist'))
);

// copies over miscellaneous files (client => dist)
gulp.task('copy', () => gulp.src(
  OTHER_SCRIPTS.concat([
    'client/**/*',
    '!client/**/*.{html,scss,js,jpg,png,gif,svg}', // all handled by other tasks
  ]), {dot: true})
  .pipe(gulp.dest('dist'))
);

// minifies all HTML, CSS and JS (.tmp & client => dist)
gulp.task('html', done => {
  const assets = $.useref.assets({
    searchPath: ['.tmp', 'client', '.'],
  });

  gulp.src('client/**/*.html')
    .pipe(assets)
    .pipe($.if('*.js', $.uglify({output: {inline_script: true}}))) // eslint-disable-line camelcase
    .pipe($.if('*.css', $.minifyCss({compatibility: '*'})))
    .pipe(assets.restore())
    .pipe($.useref())
    .pipe(gulp.dest('dist'))
    .on('end', () => {
      gulp.src('dist/**/*.html')
        .pipe($.smoosher())
        .pipe($.minifyHtml())
        .pipe(gulp.dest('dist'))
        .on('end', done);
    });
});

// clears out the dist and .tmp folders
gulp.task('clean', del.bind(null, ['.tmp', 'dist/*', '!dist/.git'], {dot: true}));

// // runs a development server (serving up .tmp and client)
gulp.task('serve', ['styles'], function (done) {
  var bundlers = getBundlers(true);

  // execute all the bundlers once, up front
  var initialBundles = mergeStream(bundlers.map(function (bundler) {
    return bundler.execute();
  }));
  initialBundles.resume(); // (otherwise never emits 'end')

  initialBundles.on('end', function () {
    // use browsersync to serve up the development app
    browserSync({
      notify: false,
      server: {
        baseDir: ['.tmp', 'client'],
        routes: {
          '/bower_components': 'bower_components'
        }
      }
    });

    gulp.watch(['client/styles/**/*.{scss,css}'], ['styles', 'scsslint', browserSync.reload]);
    gulp.watch(['client/images/**/*'], browserSync.reload);

    gulp.watch(['./views/**/*.html', 'client/data.json'], () => {
      runSequence('templates', browserSync.reload);
    });

    runSequence('templates', done);
  });
});

// builds and serves up the 'dist' directory
gulp.task('serve:dist', ['build'], done => {
  require('browser-sync').create().init({
    open: false,
    notify: false,
    server: 'dist',
    proxy: 'local',
    startPath: "/best-of-2015/"
  }, done);
});

// task to do a straightforward browserify bundle (build only)
gulp.task('scripts', function () {
  return mergeStream(getBundlers().map(function (bundler) {
    return bundler.execute();
  }));
});

// builds stylesheets with sass/autoprefixer
gulp.task('styles', () => gulp.src('client/**/*.scss')
  .pipe($.sourcemaps.init())
  .pipe($.sass({includePaths: 'bower_components'}).on('error', $.sass.logError))
  .pipe($.autoprefixer({browsers: AUTOPREFIXER_BROWSERS}))
  .pipe($.sourcemaps.write('./'))
  .pipe(gulp.dest('.tmp'))
);

// lints JS files
gulp.task('eslint', () => gulp.src('client/scripts/**/*.js')
  .pipe($.eslint())
  .pipe($.eslint.format())
  .pipe($.if(env === 'production', $.eslint.failAfterError()))
);

// lints SCSS files
gulp.task('scsslint', () => gulp.src('client/styles/**/*.scss')
  .pipe($.scssLint({bundleExec: true}))
  // .pipe($.if(env === 'production', $.scssLint.failReporter()))
);

// sets up watch-and-rebuild for JS and CSS
gulp.task('watch', done => {
  runSequence('clean', ['scripts', 'styles'], () => {
    gulp.watch('./client/**/*.scss', ['styles', 'scsslint']);
    gulp.watch('./client/**/*.{js,hbs}', ['scripts', 'eslint']);
    done();
  });
});

// makes a production build (client => dist)
gulp.task('build', done => {
  env = 'production';

  runSequence(
    ['clean'/*, 'scsslint', 'eslint'*/, 'download-data'],
    ['scripts', 'styles', 'copy', 'templates'],
    ['html', 'images'],
  done);
});

// task to deploy to the interactive server
gulp.task('deploy', done => {
  if (!DEPLOY_TARGET) {
    console.error('Please specify a DEPLOY_TARGET in your gulpfile!');
    process.exit(1);
  }

  igdeploy({
    src: 'dist',
    destPrefix: '/var/opt/customer/apps/interactive.ftdata.co.uk/var/www/html',
    dest: DEPLOY_TARGET,
  }, error => {
    if (error) return done(error);
    console.log(`Deployed to http://ig.ft.com/${DEPLOY_TARGET}/`);
  });
});

// downloads the data from bertha to client/words.json
gulp.task('download-data', () => fetch(process.env.DATA_URL)
  .then(res => res.json())
  .then(data => {
    if (env !== 'production') {
      console.log('Got %s', process.env.DATA_URL);
    }
    fs.writeFileSync('client/data.json', JSON.stringify(data, null, 2));
  })
);

gulp.task('templates', () => {

  const env = nunjucks.configure('views');
  const data = processData(JSON.parse(fs.readFileSync('client/data.json', 'utf8')));
  const slug = 'best-of-2015';
  const html = env.render('best-of-2015.html', data);
  mkdirp.sync(`.tmp/${slug}`);
  fs.writeFileSync(`.tmp/${slug}/index.html`, html);

});