// Site-wide settings. Edit values here; every page picks them up.
// Leave a value as "" to hide whatever depends on it.
export default {
  name: "Team Resistance",
  team: "FRC Team 86",
  number: 86,
  founded: 1996,
  url: "https://www.teamresistance.org",
  lang: "en",
  // Home page copy.
  intro: "a high school robotics team in Jacksonville, Florida", // the leader note under the name
  statement: "Thirty seasons of students building robots in Jacksonville.",
  lede: "Every season starts with a new game and an empty build table. Students design, machine, wire and program the robot, with mentors from local industry beside them.",
  // Words in [brackets] are highlighted in gold.
  record: "More than [50 events], [5 event wins], [9 trips to the FIRST Championship] and over [30 awards] since 1996.",
  description:
    "Team Resistance is FIRST Robotics Competition Team 86, a student robotics program in Jacksonville, Florida, inspiring young innovators through hands-on engineering since 1996.",
  location: "Jacksonville, Florida",

  org: {
    legalName: "Team Resistance, Inc.",
    status: "501(c)(3) nonprofit",
    ein: "27-1994817",
    address: ["305 E 1st St", "Jacksonville, FL 32206"],
  },

  // Social profiles. Add a URL (e.g. YouTube) to show it in the footer and contact page.
  social: [
    { label: "Instagram", url: "https://www.instagram.com/teamresistance86/", icon: "instagram" },
    { label: "Bluesky", url: "https://bsky.app/profile/teamresistance.org", icon: "bluesky" },
    { label: "GitHub", url: "https://github.com/teamresistance", icon: "github" },
    { label: "YouTube", url: "", icon: "youtube" },
  ],

  // Contact emails by topic. Leave blank to hide. (Not published here because
  // the current site obfuscates them — fill in the real addresses.)
  emails: [
    { label: "General inquiries", address: "" },
    { label: "Sponsorship", address: "" },
    { label: "Student recruitment", address: "" },
    { label: "Parent questions", address: "" },
    { label: "Media / press", address: "" },
    { label: "Volunteers & mentors", address: "" },
  ],

  meetings: [
    { season: "Fall session", months: "August – December", when: "Sundays, 1:00 – 5:00 PM" },
    { season: "Build & competition season", months: "January – April", when: "Shared with members internally" },
    { season: "Off-season", months: "May – August", when: "To be announced" },
  ],

  links: {
    brand: "https://brand.teamresistance.org",
    sponsorshipPacket: "https://www.teamresistance.org/wp-content/uploads/2026/10/SPONSORSHIP-PACKET-2026.pdf",
    first: "https://www.firstinspires.org/",
    firstLogo: "https://www.teamresistance.org/wp-content/uploads/2025/01/FIRST_Vertical_RGB_reverse.png",
    tba: "https://www.thebluealliance.com/team/86",
  },

  // Donation link (PayPal / Venmo). When blank, "Donate" buttons go to the contact page.
  donateUrl: "",

  // Contact form endpoint (e.g. Formspree, Basin, Netlify Forms, or your own handler).
  // When blank, the form shows a notice and offers the email list instead.
  contactFormAction: "",

  // Default social share image (absolute URL or /assets/... path).
  shareImage: "https://www.teamresistance.org/wp-content/uploads/2026/06/itdone-edited-1-scaled.jpg",
};
