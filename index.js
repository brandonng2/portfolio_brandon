import { fetchJSON, renderProjects, fetchGitHubData } from "./global.js";

// Get the container elements
const projectsContainer = document.querySelector(".projects__container");
const profileStats = document.querySelector("#profile-stats");

// Initialize GitHub stats
async function initializeGitHubStats() {
  try {
    const githubData = await fetchGitHubData("brandonng2");
    if (profileStats) {
      profileStats.innerHTML = `
                <dl class="stats-grid">
                    <dt>Public Repos:</dt>
                    <dd>${githubData.public_repos}</dd>
                    <dt>Public Gists:</dt>
                    <dd>${githubData.public_gists}</dd>
                    <dt>Followers:</dt>
                    <dd>${githubData.followers}</dd>
                    <dt>Following:</dt>
                    <dd>${githubData.following}</dd>
                </dl>
            `;
    }
  } catch (error) {
    console.error("Error fetching GitHub data:", error);
  }
}

// Fetch and render projects
async function initializeProjects() {
  const projects = await fetchJSON("./lib/projects.json");
  if (projects) {
    const latestProjects = projects.slice(0, 4);
    renderProjects(latestProjects, projectsContainer, "h3");
  }
}

// Initialize when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeGitHubStats();
  initializeProjects();
});
