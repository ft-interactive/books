const slugify = require('speakingurl');


var section_graphics = {
  'business': {ratio: 96, url:'windows_4'},
  'economics': {ratio: 81, url:'windows_5'},
  'politics': {ratio: 64, url:'windows_1'},
  'art': {ratio: 77, url:'windows_6'}
};

module.exports = function(data) {

  const categories = data.categories.reduce((o, row) => {
    row.slug = row.slug ? row.slug : slugify(row.name);
    row.books = [];
    row.image = section_graphics[row.slug];
    o[row.slug] = row
    return o;
  }, {});

  data.books.forEach((row) => {
    const category_slug = slugify(row.category);
    row.book.slug = slugify((row.book.fulltitle || row.book.title) + ' by ' + row.book.author);
    row.book.image = row.review.useimage && row.book.image ? row.book.image : null;
    if (categories[category_slug]) {
      categories[category_slug].books.push(row);
      categories[category_slug].reviewer = {
        name: row.review.byline,
        position: row.review.bylineposition
      }
    }
  });

  return { categories: categories };
}
