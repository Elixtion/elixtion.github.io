// Applies to every file in src/history/: same layout, same URL pattern.
// To add a season, copy _TEMPLATE.md to e.g. 2027-gamename.md and fill it in.
export default {
  layout: "layouts/season.njk",
  permalink: "/history/{{ page.fileSlug }}/",
  eleventyComputed: {
    title: (data) => `${data.year}: ${data.game}`,
    navLabel: (data) => `${data.year}: ${data.game}`,
  },
};
