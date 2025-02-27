// Global variables
let data = [];
let commits = [];
let xScale, yScale;
let selectedCommits = [];

// Define dimensions
const width = 1000;
const height = 600;

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
}

function displayStats() {
  processCommits();

  const container = d3.select("#stats");
  container.append("h2").attr("class", "summary__title").text("Summary");

  const dl = container.append("dl").attr("class", "stats");

  const numFiles = d3.group(data, (d) => d.file).size;
  const maxDepth = d3.max(data, (d) => d.depth);
  const maxLineLength = d3.max(data, (d) => d.length);
  const maxLines = d3.max(data, (d) => d.line);
  const avgLineLength = Math.round(d3.mean(data, (d) => d.length));

  const workByPeriod = d3.rollups(
    commits,
    (v) => v.length,
    (d) => {
      const hour = d.datetime.getHours();
      if (hour >= 5 && hour < 12) return "Morning";
      if (hour >= 12 && hour < 17) return "Afternoon";
      if (hour >= 17 && hour < 21) return "Evening";
      return "Night";
    }
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])[0];

  const stats = [
    { label: "Commits", value: commits.length },
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
function brushed(event, mainGroup) {
  const brushSelection = event.selection;

  selectedCommits = !brushSelection
    ? selectedCommits // preserve existing selection if brush is cleared
    : commits.filter((commit) => {
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
  mainGroup
    .selectAll("circle")
    .classed("selected", (d) => selectedCommits.includes(d));

  // Update selection stats
  updateSelectionCount();
  updateLanguageBreakdown();
}

function createBrush(svg, mainGroup) {
  const brush = d3.brush().on("start brush end", (event) => {
    brushed(event, mainGroup);
  });

  // Add brush to existing brush group
  svg.select(".brush").call(brush);

  return brush;
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

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Create and set up SVG container
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  // Create a group for the main content
  const mainGroup = svg.append("g");

  // Initialize scales
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Add gridlines
  const gridlines = mainGroup
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  gridlines
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width))
    .selectAll("line")
    .attr("stroke", (d) => getTimeColor(d));

  // Create and add axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  mainGroup
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  mainGroup
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // Sort commits by size
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // Add dots
  const dots = mainGroup.append("g").attr("class", "dots");

  dots
    .selectAll("circle")
    .data(sortedCommits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", (d) => getTimeColor(d.datetime.getHours()))
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      updateTooltipContent(commit);
      updateTooltipPosition(event);
      d3.select(event.target)
        .transition()
        .duration(200)
        .style("fill-opacity", 1)
        .attr("r", (d) => rScale(d.totalLines) * 1.2);
    })
    .on("mousemove", (event) => {
      updateTooltipPosition(event);
    })
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
      mainGroup
        .selectAll("circle")
        .classed("selected", (d) => selectedCommits.includes(d));

      // Update selection stats
      updateSelectionCount();
      updateLanguageBreakdown();

      // Update visual state of this circle
      d3.select(event.target).classed(
        "selected",
        selectedCommits.includes(commit)
      );
    });

  // Create and add brush
  const brushGroup = svg.append("g").attr("class", "brush");
  createBrush(svg, mainGroup);

  // Ensure dots are above brush overlay by moving the brush group below dots
  brushGroup.lower();

  // Set pointer-events to none on the brush overlay to allow interaction with dots
  brushGroup.select(".overlay").style("pointer-events", "all");

  brushGroup.select(".selection").style("pointer-events", "none");

  brushGroup.selectAll(".handle").style("pointer-events", "none");

  // Add legend
  const legendData = [
    Math.round(minLines),
    Math.round((minLines + maxLines) / 2),
    Math.round(maxLines),
  ];

  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr(
      "transform",
      `translate(${usableArea.right - 100}, ${usableArea.top + 20})`
    );

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
  displayStats();
  createScatterplot();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
});
