# [Books](https://ft-interactive.github.io/books)

[![Build Status][travis-image]][travis-url] [![Dependency Status][devdeps-image]][devdeps-url]

> Web pages to display Book Review lists.

At present we have just a single list: 

1. Christmas edition of the Best of 2015.

## Local

Create a `.env` file in the root of the project. This must contain the url of the Bertha sheet with the data/content:

```ini
DATA_URL=http://bertha.ig.ft.com/URL_TO_CONTENT
```

To get a recent copy of the content run the data task

```shell
> npm run data
```

**Coding**

```shell
> npm start
```

## Uses the Starter Kit

This project was made using our [starter kit](http://ft-interactive.github.io/guides/project-starter-kit/).

## Licence
This software is published by the Financial Times under the [MIT licence](http://opensource.org/licenses/MIT).

<!-- badge URLs -->
[travis-url]: http://travis-ci.org/ft-interactive/books
[travis-image]: https://img.shields.io/travis/ft-interactive/books.svg?style=flat-square

[devdeps-url]: https://david-dm.org/ft-interactive/books#info=devDependencies
[devdeps-image]: https://img.shields.io/david/dev/ft-interactive/books.svg?style=flat-square
