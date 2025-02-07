import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Get the container elements
const projectsContainer = document.querySelector(".projects__container");
const searchInput = document.querySelector(".searchBar");

let projects = []; // Store projects globally
let query = "";
let selectedIndex = -1; // Track selected pie wedge

// Initialize when the DOM is loaded
document.addEventListener("DOMContentLoaded", initializeProjects);

// Fetch and render projects
async function initializeProjects() {
  projects = await fetchJSON("../lib/projects.json");
  if (projects) {
    renderProjects(projects, projectsContainer, "h3");
    renderPieChart(projects);
    setupSearch();
  }
}

function setupSearch() {
  searchInput.addEventListener("input", (event) => {
    const filteredProjects = setQuery(event.target.value);
    renderProjects(filteredProjects, projectsContainer, "h3");
    renderPieChart(filteredProjects);
    // Reset selected index when searching
    selectedIndex = -1;
  });
}

function setQuery(value) {
  query = value.toLowerCase();
  return projects.filter((project) =>
    project.title.toLowerCase().includes(query)
  );
}

function renderPieChart(projectsGiven) {
  // Clear existing content
  const svg = d3.select("#projects-plot");
  svg.selectAll("*").remove();
  d3.select(".legend").selectAll("*").remove();

  // Process data using d3.rollups
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  );

  // Format data for visualization
  const data = rolledData
    .map(([year, count]) => ({
      value: count,
      label: year,
    }))
    .sort((a, b) => b.label - a.label);

  // Set up the pie layout generator
  const sliceGenerator = d3.pie().value((d) => d.value);

  // Create the arc generator
  const arc = d3.arc().innerRadius(0).outerRadius(20);

  // Generate the pie chart data
  const arcData = sliceGenerator(data);

  // Create a color scale
  const colors = d3.scaleOrdinal(d3.schemeTableau10);

  // Draw pie chart
  svg
    .selectAll("path")
    .data(arcData)
    .join("path")
    .attr("d", arc)
    .attr("fill", (d, i) => colors(i))
    .attr("class", (d, i) => (i === selectedIndex ? "selected" : ""))
    .on("click", (event, d) => {
      const index = arcData.indexOf(d);
      handleWedgeClick(index, data, svg);
    });

  // Create legend
  const legend = d3.select(".legend");

  arcData.forEach((d, idx) => {
    legend
      .append("li")
      .attr("class", `legend-item ${idx === selectedIndex ? "selected" : ""}`)
      .attr("style", `--color:${colors(idx)}`)
      .html(
        `<span class="swatch"></span> ${d.data.label} <em>(${d.data.value})</em>`
      )
      .on("click", () => {
        handleWedgeClick(idx, data, svg);
      });
  });
}

function handleWedgeClick(index, data, svg) {
  // Toggle selection
  selectedIndex = selectedIndex === index ? -1 : index;

  // Update wedge styles
  svg
    .selectAll("path")
    .attr("class", (d, idx) => (idx === selectedIndex ? "selected" : ""));

  // Update legend styles
  d3.select(".legend")
    .selectAll("li")
    .attr("class", (d, idx) => {
      const baseClass = "legend-item";
      return idx === selectedIndex ? `${baseClass} selected` : baseClass;
    });

  // Filter projects by combining both search query and year selection
  let filteredProjects = projects;

  // Apply search filter if query exists
  if (query) {
    filteredProjects = filteredProjects.filter((project) =>
      project.title.toLowerCase().includes(query)
    );
  }

  // Apply year filter if a wedge is selected
  if (selectedIndex !== -1) {
    const selectedYear = data[selectedIndex].label;
    filteredProjects = filteredProjects.filter(
      (project) => project.year === selectedYear
    );
  }

  renderProjects(filteredProjects, projectsContainer, "h3");
}
