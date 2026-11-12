// Main navigation.
// - `collection` auto-fills the dropdown from that collection, so new robot
//   seasons and resource pages appear in the menu without editing this file.
// - `extra` adds fixed links (e.g. external documents) to the end of a dropdown.
export default [
  { label: "About", url: "/about-team-resistance/" },
  { label: "Robots", url: "/history/", collection: "seasons", overview: "All seasons" },
  { label: "Awards", url: "/awards/" },
  { label: "Sponsors", url: "/sponsors/" },
  { label: "Newsletter", url: "/newsletter/" },
  {
    label: "Resources",
    url: "/resources/",
    collection: "resources",
    overview: "All resources",
    extra: [
      { label: "Branding & team identity", url: "https://brand.teamresistance.org", external: true, description: "Official logos, colors, fonts and templates." },
      {
        label: "Sponsorship packet (PDF)",
        url: "https://www.teamresistance.org/wp-content/uploads/2026/10/SPONSORSHIP-PACKET-2026.pdf",
        external: true,
        description: "Sponsor benefits and how to partner with the team.",
      },
    ],
  },
  { label: "Contact", url: "/contact/" },
];
