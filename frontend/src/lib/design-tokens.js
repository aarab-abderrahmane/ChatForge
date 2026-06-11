/** Hand-drawn design system tokens */

export const colors = {
  background: "#fdfbf7",
  foreground: "#2d2d2d",
  muted: "#e5e0d8",
  accent: "#ff4d4d",
  border: "#2d2d2d",
  secondary: "#2d5da1",
  postit: "#fff9c4",
  white: "#ffffff",
};

export const radius = {
  wobbly: "255px 15px 225px 15px / 15px 225px 15px 255px",
  wobblyMd: "185px 25px 205px 25px / 25px 205px 25px 185px",
  wobblySm: "125px 12px 115px 12px / 12px 115px 12px 125px",
};

export const shadows = {
  hard: "4px 4px 0px 0px #2d2d2d",
  hardLg: "8px 8px 0px 0px #2d2d2d",
  hardSm: "3px 3px 0px 0px rgba(45, 45, 45, 0.1)",
  hardHover: "2px 2px 0px 0px #2d2d2d",
};

export const wobblyStyle = (size = "md") => ({
  borderRadius: radius[size === "sm" ? "wobblySm" : size === "lg" ? "wobbly" : "wobblyMd"],
});
