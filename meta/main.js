// Global variables
let data = [];
let commits = [];
let filteredCommits = [];
let xScale, yScale;
let selectedCommits = [];

// Define dimensions
const width = 1000;
const height = 600;
let commitProgress = 100;
let timeScale, commitMaxTime;

// Selection functions
function isCommitSelected(commit) {
  return selectedCommits.includes(commit);
}

function updateSelectionCount() {
  const countElement = document.getElementById("selection-count");
  countElement.textContent = `${
    selectedCommits.length || "No"
  } commits selected`;

  return selectedCommits;
}

function updateLanguageBreakdown() {
  const container = document.getElementById("language-breakdown");

  if (!selectedCommits.length) {
    container.innerHTML = "";
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  // Update DOM with breakdown
  container.innerHTML = "";

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }

  return breakdown;
}

// Tooltip handling functions
function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  const margin = 16;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipRect = tooltip.getBoundingClientRect();

  let left = event.clientX + margin;
  let top = event.clientY + margin;

  if (left + tooltipRect.width > viewportWidth) {
    left = event.clientX - tooltipRect.width - margin;
  }

  if (top + tooltipRect.height > viewportHeight) {
    top = event.clientY - tooltipRect.height - margin;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function updateTooltipContent(commit) {
  const tooltip = document.getElementById("commit-tooltip");

  if (!commit || !commit.id) {
    tooltip.hidden = true;
    return;
  }

  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");
  const time = document.getElementById("commit-time");
  const author = document.getElementById("commit-author");
  const lines = document.getElementById("commit-lines");

  link.href = commit.url;
  link.textContent = commit.id.slice(0, 7);

  date.textContent = commit.datetime.toLocaleString("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  time.textContent = commit.datetime.toLocaleString("en", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  author.textContent = commit.author;
  lines.textContent = commit.totalLines;

  tooltip.hidden = false;
}

// Data processing functions
function processCommits() {
  commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: "https://github.com/vis-society/lab-7/commit/" + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
        configurable: true,
        writable: true,
      });

      return ret;
    });

  // Initially set filteredCommits to all commits
  filteredCommits = [...commits];
}

function displayStats() {
  // Use filteredCommits instead of commits
  const container = d3.select("#stats");
  container.html(""); // Clear existing content
  container.append("h2").attr("class", "summary__title").text("Summary");

  const dl = container.append("dl").attr("class", "stats");

  const numFiles = d3.group(data, (d) => d.file).size;
  const maxDepth = d3.max(data, (d) => d.depth);
  const maxLineLength = d3.max(data, (d) => d.length);
  const maxLines = d3.max(data, (d) => d.line);
  const avgLineLength = Math.round(d3.mean(data, (d) => d.length));

  const workByPeriod = d3.rollups(
    filteredCommits, // Use filteredCommits instead of commits
    (v) => v.length,
    (d) => {
      const hour = d.datetime.getHours();
      if (hour >= 5 && hour < 12) return "Morning";
      if (hour >= 12 && hour < 17) return "Afternoon";
      if (hour >= 17 && hour < 21) return "Evening";
      return "Night";
    }
  );

  // Check if workByPeriod has entries before finding max
  const maxPeriod = workByPeriod.length
    ? d3.greatest(workByPeriod, (d) => d[1])[0]
    : "N/A";

  const stats = [
    { label: "Commits", value: filteredCommits.length }, // Use filteredCommits count
    { label: "Files", value: numFiles },
    { label: "Total LOC", value: data.length },
    { label: "Max Depth", value: maxDepth },
    { label: "Longest Line", value: maxLineLength },
    { label: "Max Lines", value: maxLines },
    { label: "Most Active", value: maxPeriod },
    { label: "Avg Length", value: avgLineLength },
  ];

  stats.forEach((stat) => {
    dl.append("dt").text(stat.label);
    dl.append("dd").text(stat.value);
  });
}

function getTimeColor(hour) {
  if (hour < 6) return "#2c5282"; // Deep blue for night
  if (hour < 12) return "#ed8936"; // Orange for morning
  if (hour < 18) return "#ecc94b"; // Yellow for afternoon
  return "#4299e1"; // Light blue for evening
}

// Create brush function
function brushed(event) {
  const brushSelection = event.selection;

  selectedCommits = !brushSelection
    ? selectedCommits // preserve existing selection if brush is cleared
    : filteredCommits.filter((commit) => {
        // Use filteredCommits instead of commits
        const x = xScale(commit.datetime);
        const y = yScale(commit.hourFrac);
        return (
          x >= brushSelection[0][0] &&
          x <= brushSelection[1][0] &&
          y >= brushSelection[0][1] &&
          y <= brushSelection[1][1]
        );
      });

  // Update visual selection
  d3.selectAll("circle").classed("selected", (d) =>
    selectedCommits.includes(d)
  );

  // Update selection stats
  updateSelectionCount();
  updateLanguageBreakdown();
}

function createBrush(svg) {
  const brush = d3.brush().on("start brush end", brushed);

  // Add brush to existing brush group
  svg.select(".brush").call(brush);

  return brush;
}

// Time filtering functions
function updateTimeDisplay() {
  const selectedTime = document.getElementById("selectedTime");
  commitMaxTime = timeScale.invert(commitProgress);

  selectedTime.textContent = commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });

  filterCommitsByTime();
  updateScatterplot(filteredCommits);
  displayStats();
}

function filterCommitsByTime() {
  // Update filteredCommits based on commitMaxTime
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  // Clear selection when filter changes
  selectedCommits = [];
  updateSelectionCount();
  updateLanguageBreakdown();
}

function createScatterplot() {
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Add our fixed styles for circle transitions
  if (!document.getElementById("circle-transitions")) {
    const style = document.createElement("style");
    style.id = "circle-transitions";
    style.textContent = `
      circle {
        transition: fill 200ms, fill-opacity 200ms, r 300ms ease-out;
      }
    `;
    document.head.appendChild(style);
  }

  // Create and set up SVG container - only once
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  // Create a group for the main content
  const mainGroup = svg.append("g").attr("class", "main-group");

  // Initialize scales with empty domains initially
  xScale = d3
    .scaleTime()
    .domain([new Date(), new Date()])
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Add gridlines container
  mainGroup
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  // Create and add axes groups
  mainGroup
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${usableArea.bottom})`);

  mainGroup
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  // Add dots group
  mainGroup.append("g").attr("class", "dots");

  // Create and add brush
  svg.append("g").attr("class", "brush");

  // Add legend group
  svg
    .append("g")
    .attr("class", "legend")
    .attr(
      "transform",
      `translate(${usableArea.right - 100}, ${usableArea.top + 20})`
    );

  return svg;
}

function updateScatterplot(filteredData) {
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Get existing SVG or create it if it doesn't exist
  let svg = d3.select("#chart svg");
  if (svg.empty()) {
    svg = createScatterplot();
  }

  const mainGroup = svg.select(".main-group");

  // Use filteredData for min/max calculations
  const [minLines, maxLines] = filteredData.length
    ? d3.extent(filteredData, (d) => d.totalLines)
    : [0, 1];
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Update scales using filteredData
  xScale = d3
    .scaleTime()
    .domain(
      filteredData.length
        ? d3.extent(filteredData, (d) => d.datetime)
        : [new Date(), new Date()]
    )
    .range([usableArea.left, usableArea.right])
    .nice();

  // Update gridlines
  const gridlines = mainGroup.select(".gridlines");
  gridlines
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width))
    .selectAll("line")
    .attr("stroke", (d) => getTimeColor(d));

  // Update axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  mainGroup.select(".x-axis").call(xAxis);
  mainGroup.select(".y-axis").call(yAxis);

  // Sort commits by size for better visualization (smaller on top)
  const sortedCommits = filteredData.length
    ? d3.sort([...filteredData], (d) => -d.totalLines)
    : [];

  // Update dots with proper transitions
  const dots = mainGroup.select(".dots");

  // Use data join with key function for proper updates
  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id) // Key by id to maintain identity
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("cx", (d) => xScale(d.datetime))
          .attr("cy", (d) => yScale(d.hourFrac))
          .attr("fill", (d) => getTimeColor(d.datetime.getHours()))
          .style("fill-opacity", 0.7)
          .attr("r", 0) // Start with radius 0
          .call((enter) =>
            enter
              .transition()
              .duration(300)
              .attr("r", (d) => rScale(d.totalLines))
          ),
      (update) =>
        update.call((update) =>
          update
            .transition()
            .duration(300)
            .attr("cx", (d) => xScale(d.datetime))
            .attr("cy", (d) => yScale(d.hourFrac))
            .attr("r", (d) => rScale(d.totalLines))
        ),
      (exit) =>
        exit.call((exit) =>
          exit.transition().duration(300).attr("r", 0).remove()
        )
    )
    .on("mouseenter", (event, commit) => {
      updateTooltipContent(commit);
      updateTooltipPosition(event);
      d3.select(event.target)
        .transition()
        .duration(200)
        .style("fill-opacity", 1)
        .attr("r", (d) => rScale(d.totalLines) * 1.2);
    })
    .on("mousemove", updateTooltipPosition)
    .on("mouseleave", (event) => {
      updateTooltipContent({});
      d3.select(event.target)
        .transition()
        .duration(200)
        .style("fill-opacity", 0.7)
        .attr("r", (d) => rScale(d.totalLines));
    })
    .on("click", (event, commit) => {
      // Toggle selection for the clicked commit
      if (selectedCommits.includes(commit)) {
        selectedCommits = selectedCommits.filter((c) => c !== commit);
      } else {
        selectedCommits = [...selectedCommits, commit];
      }

      // Update visual selection
      d3.selectAll("circle").classed("selected", (d) =>
        selectedCommits.includes(d)
      );

      // Update selection stats
      updateSelectionCount();
      updateLanguageBreakdown();
    });

  // Update brush
  createBrush(svg);

  // Ensure brush is below dots
  svg.select(".brush").lower();

  // Set pointer-events properly for brush
  svg.select(".brush .overlay").style("pointer-events", "all");
  svg.select(".brush .selection").style("pointer-events", "none");
  svg.select(".brush .handle").style("pointer-events", "none");

  // Update legend
  const legend = svg.select(".legend");
  legend.selectAll("*").remove(); // Clear existing legend

  // Add legend only if we have data
  if (filteredData.length) {
    const legendData = [
      Math.round(minLines),
      Math.round((minLines + maxLines) / 2),
      Math.round(maxLines),
    ];

    const legendItems = legend
      .selectAll("g")
      .data(legendData)
      .join("g")
      .attr("transform", (d, i) => `translate(0, ${i * 40})`);

    legendItems
      .append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", (d) => rScale(d))
      .attr("fill", "#666")
      .style("fill-opacity", 0.7);

    legendItems
      .append("text")
      .attr("x", 35)
      .attr("y", 5)
      .text((d) => `${d} lines`)
      .attr("font-size", "12px")
      .attr("fill", "#666");
  }
}

// Update the loadData function
async function loadData() {
  data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));

  processCommits();

  // Initialize time scale after processing commits
  timeScale = d3
    .scaleTime()
    .domain([
      d3.min(commits, (d) => d.datetime),
      d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);

  commitMaxTime = timeScale.invert(commitProgress);

  // Set up slider event listener
  const timeSlider = document.getElementById("time-slider");
  timeSlider.addEventListener("input", function () {
    commitProgress = Number(this.value);
    updateTimeDisplay();
  });

  // Initial update
  updateTimeDisplay();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
});
