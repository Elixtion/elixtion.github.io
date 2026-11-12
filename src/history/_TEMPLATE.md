---
# ─────────────────────────────────────────────────────────────────────
# NEW SEASON TEMPLATE
# 1. Copy this file to src/history/YYYY-game-name.md (e.g. 2027-gamename.md).
#    The file name becomes the URL: /history/2027-gamename/
# 2. Fill in the fields below. Delete any you don't need.
# 3. Awards and FIRST Championship trips are pulled automatically by year from
#    src/_data/awards.json and src/_data/championships.json. Add them there.
# The season then appears in the Robots menu, the /history/ page, the home
# page (as the latest robot), the 1996-to-now dimension and the older/newer
# links. No other edits required.
# (Files starting with "_" are ignored, so this template never publishes.)
# ─────────────────────────────────────────────────────────────────────
year: 2027
game: Game Name
robot: Robot name
programSeason: 31st season
summary: One or two sentences shown on cards and at the top of the page.
hero:
  src: /assets/img/2027/robot.jpg
  alt: Describe what the photo shows, e.g. "The robot lifting a game piece at the Orlando Regional"
  caption: Short figure caption shown under the photo.
# Optional, used on the home page while this is the newest season:
feature:                 # second photo for the home page detail view
  src: /assets/img/2027/on-field.jpg
  alt: The robot on the field at the Orlando Regional
  caption: On the field at the Orlando Regional.
highlights:              # up to three small figures under it
  - { src: /assets/img/2027/intake.jpg, alt: "Intake prototype", caption: "Intake, first version." }
specs:
  - { label: Drivetrain, value: Swerve }
  - { label: Weight, value: "115 lb" }
  - { label: Language, value: Java }
events:
  - name: Orlando Regional
    when: Week 3
    rank: 1
    record: 10-2-0
    alliance: Alliance 1 (captain)
    result: Winner
links:
  - { label: Technical binder (PDF), url: "/assets/docs/2027-binder.pdf" }
  - { label: Code on GitHub, url: "https://github.com/teamresistance" }
illustration: /assets/robots/2027.svg   # optional drawing of the robot (SVG, see src/assets/robots/)
photos:
  build:
    # w and h (pixel size) are optional but stop the page jumping while photos load.
    # Add tall: true for portrait photos.
    - { src: /assets/img/2027/kickoff.jpg, alt: "Students watching the game reveal at kickoff", caption: "Kickoff", w: 1024, h: 768 }
    - { src: /assets/img/2027/drivers.jpg, alt: "The drive team behind the glass", caption: "Drive team", tall: true, w: 768, h: 1024 }
---

## Build season

Write the story of the season in Markdown. Insert a photo gallery anywhere:

{% gallery photos.build, "Build season photos" %}

## Orlando Regional

How the event went.
