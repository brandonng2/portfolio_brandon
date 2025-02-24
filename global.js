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

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}

// New project-related functions
export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching or parsing JSON data:", error);
  }
}

export function renderProjects(
  projects,
  containerElement,
  headingLevel = "h2"
) {
  // Clear existing content
  containerElement.innerHTML = "";

  // Update projects count if projects-title exists
  const projectsTitle = document.querySelector(".projects-title");
  if (projectsTitle) {
    projectsTitle.textContent = `(${projects.length}) Projects`;
  }

  // Check if we're on the home page
  const isHomePage = document.documentElement.classList.contains("home");

  // Render each project
  projects.forEach((project) => {
    const article = document.createElement("article");
    article.className = "project__card";

    // Determine the correct image path based on the page
    const imagePath = isHomePage ? `./${project.image}` : `../${project.image}`;

    article.innerHTML = `
    <p class="project__year">${project.year}</p>
    <h3 class="project__name">${project.title}</h3>
    <img src="${imagePath}" alt="${project.title}" class="project__img">
    <p class="project__description">${project.description}</p>
    <span class="project__language">${project.language}</span>
    `;

    // Add click handler if project has a URL
    if (project.url) {
      article.style.cursor = "pointer";
      article.addEventListener("click", () => {
        window.open(project.url, "_blank", "noopener,noreferrer");
      });
    }

    containerElement.appendChild(article);
  });
}

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
  { url: "meta/", title: "Meta" },
  { url: "contact/", title: "Contact" },
];

const ARE_WE_HOME = document.documentElement.classList.contains("home");

// Create nav items
for (let p of pages) {
  let url = p.url;
  if (!url.startsWith("http")) {
    console.log(ARE_WE_HOME);
    url = ARE_WE_HOME ? "./" + url : "../" + url;
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
