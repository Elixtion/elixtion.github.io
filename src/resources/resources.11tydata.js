// Every Markdown file in src/resources/ becomes a resource page with the
// standard layout and shows up in the Resources menu, footer and index.
// Front matter: title, navLabel (short menu name), order (menu position),
// permalink (optional — defaults to /resources/<file-name>/), lead, documents.
export default {
  layout: "layouts/page.njk",
  permalink: (data) => data.permalink || `/resources/${data.page.fileSlug}/`,
};
