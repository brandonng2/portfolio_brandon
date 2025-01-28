import { fetchJSON, renderProjects } from "../global.js";

// Get the container element
const projectsContainer = document.querySelector(".projects__container");

// Fetch and render projects
async function initializeProjects() {
  const projects = await fetchJSON("../lib/projects.json");
  if (projects) {
    renderProjects(projects, projectsContainer, "h3");
  }
}

// Initialize when the DOM is loaded
document.addEventListener("DOMContentLoaded", initializeProjects);
