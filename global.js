// Tab switching functionality
const educationTab = document.getElementById("educationTab");
const experienceTab = document.getElementById("experienceTab");
const educationContent = document.getElementById("education");
const experienceContent = document.getElementById("experience");

educationTab?.addEventListener("click", () => {
  educationTab.classList.add("qualification__active");
  experienceTab.classList.remove("qualification__active");
  educationContent.classList.add("qualification__content-active");
  experienceContent.classList.remove("qualification__content-active");
});

experienceTab?.addEventListener("click", () => {
  experienceTab.classList.add("qualification__active");
  educationTab.classList.remove("qualification__active");
  experienceContent.classList.add("qualification__content-active");
  educationContent.classList.remove("qualification__content-active");
});

// Helper function to get elements
export function $$(selector) {
  return Array.from(document.querySelectorAll(selector));
}

// Create header and nav structure
const header = document.createElement("header");
header.className = "header";

const nav = document.createElement("nav");
nav.className = "nav";

const logoLink = document.createElement("a");
logoLink.href = "./";
logoLink.className = "nav__logo";
logoLink.textContent = "Ng";

const menuDiv = document.createElement("div");
menuDiv.className = "nav__menu";

const ul = document.createElement("ul");
ul.className = "nav__list";

// Define pages
const pages = [
  { url: "", title: "Home" },
  { url: "skills/", title: "Skills" },
  { url: "qualifications/", title: "CV/Resume" },
  { url: "project/", title: "Projects" },
  { url: "contact/", title: "Contact" },
];

const ARE_WE_HOME = document.documentElement.classList.contains("home");

// Create nav items
for (let p of pages) {
  let url = p.url;
  if (!ARE_WE_HOME && !url.startsWith("http")) {
    url = "./" + url;
  }

  const li = document.createElement("li");
  li.className = "nav__item";

  const a = document.createElement("a");
  a.href = url;
  a.className = "nav__link";
  a.textContent = p.title;

  a.classList.toggle(
    "active-link",
    a.host === location.host && a.pathname === location.pathname
  );

  if (a.host !== location.host) {
    a.target = "_blank";
  }

  li.appendChild(a);
  ul.appendChild(li);
}

// Create theme toggle
const themeToggle = document.createElement("div");
themeToggle.className = "theme-toggle";
themeToggle.style.marginLeft = "50px";
themeToggle.innerHTML = `Theme: <select class="theme-toggle__select">
    <option value="light dark">Auto ${
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "(Dark)"
        : "(Light)"
    }</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>`;

// Assemble the nav structure
menuDiv.appendChild(ul);
nav.appendChild(logoLink);
nav.appendChild(menuDiv);
nav.appendChild(themeToggle);
header.appendChild(nav);
document.body.prepend(header);

// Theme switching functionality
const select = document.querySelector(".theme-toggle__select");

function setColorScheme(scheme) {
  if (scheme === "light dark") {
    const isSystemDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    document.documentElement.style.setProperty(
      "color-scheme",
      isSystemDark ? "dark" : "light"
    );
    if (isSystemDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } else {
    document.documentElement.style.setProperty("color-scheme", scheme);
    if (scheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
  select.value = scheme;
  localStorage.colorScheme = scheme;
}

// Add system preference listener
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    if (select.value === "light dark") {
      setColorScheme("light dark");
    }
  });

// Load saved preference or default to auto
if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

// Handle theme changes
select.addEventListener("input", (event) => {
  setColorScheme(event.target.value);
});
