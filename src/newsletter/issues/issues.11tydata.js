// Every file in src/newsletter/issues/ is a newsletter issue or news post.
// Front matter: title, date (YYYY-MM-DD), summary, pdf (optional link). Body is optional Markdown.
export default {
  layout: "layouts/issue.njk",
  permalink: "/newsletter/{{ page.fileSlug }}/",
};
