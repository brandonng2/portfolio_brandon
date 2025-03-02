// Load data and initialize visualization
async function loadData() {
  try {
    data = await d3.csv("loc.csv", (row) => ({
      ...row,
      line: Number(row.line),
      length: Number(row.length),
      date: new Date(row.date + "T00:00" + row.timezone),
      datetime: new Date(row.datetime),
    }));

    console.log(`Loaded ${data.length} rows of data`);

    processCommits();
    console.log(`Processed ${commits.length} unique commits`);

    // Initialize scroll event listener for transitions
    window.addEventListener(
      "scroll",
      debounce(() => {
        checkVisibleCommits();
      }, 100)
    );

    // Initial update to display everything
    updateScatterplot(filteredCommits);
    displayStats();
    displayCommitFiles();

    // Display all commits
    displayAllCommits();

    // Setup time slider
    setupTimeSlider();
  } catch (error) {
    console.error("Error loading or processing data:", error);
  }
}

// Check which commits are currently visible
function checkVisibleCommits() {
  // We'll use this instead of IntersectionObserver for compatibility
  const items = document.querySelectorAll(".item");
  const visibleItems = [];

  // Get current scroll position
  const scrollPosition = window.scrollY;
  const viewportHeight = window.innerHeight;

  // Check if any day sections are in view
  const daySections = document.querySelectorAll(".day-section");
  const visibleDays = [];

  daySections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    // Check if the section is at least partially visible
    if (rect.top < viewportHeight && rect.bottom > 0) {
      visibleDays.push(section.getAttribute("data-day"));
    }
  });

  // Get all commits from visible days
  if (visibleDays.length > 0) {
    const commitsToHighlight = filteredCommits.filter((c) =>
      visibleDays.includes(c.day)
    );

    // Determine scroll direction
    const scrollingDown = scrollPosition > lastScrollY;
    lastScrollY = scrollPosition;

    // Update the scatterplot with transitions
    updateScatterplotWithTransition(commitsToHighlight, scrollingDown);
  }
}

// Simple debounce function to prevent too many scroll events
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Document ready handler
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
});
// Global variables
let data = [];
let commits = [];
let filteredCommits = [];
let xScale, yScale;
let selectedCommits = [];
let files = [];
let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
let visibleCommits = []; // Track currently visible commits
let lastScrollY = 0; // Track last scroll position

// Define dimensions
const width = 1000;
const height = 600;
let commitProgress = 100; // Default slider value (show all commits)
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
        day: datetime.toISOString().split("T")[0], // Add day for grouping
      };

      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
        configurable: true,
        writable: true,
      });

      return ret;
    });

  // Sort commits by date for the visualization
  commits = d3.sort(commits, (d) => d.datetime);

  // Initialize time scale after processing commits
  timeScale = d3
    .scaleTime()
    .domain([
      d3.min(commits, (d) => d.datetime),
      d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);

  // If slider is at 100 (default), show all commits
  if (commitProgress === 100) {
    commitMaxTime = timeScale.domain()[1]; // End date is the max date
  } else {
    commitMaxTime = timeScale.invert(commitProgress);
  }

  // Set filteredCommits to all commits initially (by default show all)
  filterCommitsByTime();

  // Initialize visibleCommits to empty array
  visibleCommits = [];

  console.log(`After filtering: ${filteredCommits.length} commits to display`);
}

function displayStats() {
  // Use either selected commits or all filtered commits
  const commitsToUse =
    selectedCommits.length > 0 ? selectedCommits : filteredCommits;

  const container = d3.select("#stats");
  container.html(""); // Clear existing content

  const dl = container.append("dl").attr("class", "stats");

  // Calculate stats based on the commits we're using
  const lines = commitsToUse.flatMap((d) => d.lines);
  const totalLinesInView = lines.length;

  const fileCount = d3.group(lines, (d) => d.file).size;
  const maxLineLength = d3.max(lines, (d) => d.length) || 0;
  const avgLineLength =
    totalLinesInView > 0 ? Math.round(d3.mean(lines, (d) => d.length)) : 0;

  const workByPeriod = d3.rollups(
    commitsToUse,
    (v) => v.length,
    (d) => {
      const hour = d.datetime.getHours();
      if (hour >= 5 && hour < 12) return "Morning";
      if (hour >= 12 && hour < 17) return "Afternoon";
      if (hour >= 17 && hour < 21) return "Evening";
      return "Night";
    }
  );

  const stats = [
    { label: "Commits", value: commitsToUse.length },
    { label: "Files", value: fileCount },
    { label: "Total LOC", value: totalLinesInView },
    { label: "Longest Line", value: maxLineLength },
    { label: "Avg Length", value: avgLineLength },
  ];

  // Add work by period as additional stats
  workByPeriod.forEach(([period, count]) => {
    stats.push({
      label: period,
      value: count + (count === 1 ? " commit" : " commits"),
    });
  });

  stats.forEach((stat) => {
    dl.append("dt").text(stat.label);
    dl.append("dd").text(stat.value);
  });
}

// Display commit files
function displayCommitFiles() {
  // Use either selected commits or all filtered commits
  let commitsToUse =
    selectedCommits.length > 0 ? selectedCommits : filteredCommits;

  const lines = commitsToUse.flatMap((d) => d.lines);

  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    });

  files = d3.sort(files, (d) => -d.lines.length);

  d3.select(".files").selectAll("div").remove();

  let filesContainer = d3
    .select(".files")
    .selectAll("div")
    .data(files)
    .enter()
    .append("div");

  filesContainer
    .append("dt")
    .html(
      (d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`
    );

  filesContainer
    .append("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .enter()
    .append("div")
    .attr("class", "line")
    .style("background", (d) => fileTypeColors(d.type));
}

// Time filtering functions
function updateTimeDisplay() {
  const selectedTime = document.getElementById("selectedTime");
  if (selectedTime) {
    selectedTime.textContent = commitMaxTime.toLocaleString("en", {
      dateStyle: "long",
      timeStyle: "short",
    });
  }

  filterCommitsByTime();
  updateScatterplot(filteredCommits);
  displayStats();
  displayCommitFiles();

  // Update commits display
  displayAllCommits();
}

function filterCommitsByTime() {
  // Update filteredCommits based on commitMaxTime
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  // Clear selection when filter changes
  selectedCommits = [];
  updateSelectionCount();
  updateLanguageBreakdown();

  // Reset visible commits when filter changes
  visibleCommits = [];
}

// Display all commits with scroll detection
function displayAllCommits() {
  // Get the container and clear its contents
  const container = d3.select("#scroll-container");
  container.html("");

  // Group commits by day
  const commitsByDay = d3.group(filteredCommits, (d) => d.day);

  // Sort days chronologically
  const sortedDays = Array.from(commitsByDay.keys()).sort();

  // Create a container for all days
  const allCommitsContainer = container
    .append("div")
    .attr("class", "all-commits-container");

  // Add day sections
  sortedDays.forEach((day) => {
    const dayCommits = commitsByDay.get(day);
    const date = new Date(day);

    // Create a day section
    const daySection = allCommitsContainer
      .append("div")
      .attr("class", "day-section")
      .attr("data-day", day);

    // Add date header
    daySection
      .append("h3")
      .attr("class", "day-header")
      .text(
        date.toLocaleDateString("en", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );

    // Add all commits for this day
    daySection
      .selectAll(".item")
      .data(dayCommits)
      .enter()
      .append("div")
      .attr("class", "item")
      .attr("data-commit-id", (d) => d.id)
      .html((d) => {
        // Get files changed in this commit
        const fileCount = d3.rollups(
          d.lines,
          (D) => D.length,
          (file) => file.file
        ).length;
        const fileList = d3
          .groups(d.lines, (line) => line.file)
          .map(([filename]) => filename)
          .slice(0, 3); // Get top 3 files

        // Format the timestamp
        const formattedTime = d.datetime.toLocaleString("en", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });

        // Create the narrative text
        return `
          <p>
            <span class="commit-time">${formattedTime}</span> 
            <a href="${d.url}" target="_blank">${d.id.slice(0, 7)}</a> 
            by ${d.author}. 
            ${d.totalLines} lines were edited across ${fileCount} ${
          fileCount === 1 ? "file" : "files"
        }.
            ${
              fileCount > 0
                ? `Main files: ${fileList
                    .map((f) => `<code>${f}</code>`)
                    .join(", ")}`
                : ""
            }
          </p>
        `;
      })
      .on("mouseenter", function (event, d) {
        // Highlight this commit in the chart
        updateScatterplotHighlights([d]);

        // Highlight this item
        d3.select(this).classed("highlighted", true);
      })
      .on("mouseleave", function () {
        // Remove highlights if no selection
        if (selectedCommits.length === 0) {
          updateScatterplotHighlights([]);
        }

        // Remove item highlight
        d3.select(this).classed("highlighted", false);
      });
  });

  // Set up scroll observation
  setupScrollObserver();
}

// Create a scroll observer to detect which commits are visible
function setupScrollObserver() {
  // First remove any existing observer
  if (window.commitObserver) {
    window.commitObserver.disconnect();
  }

  // Create new observer
  window.commitObserver = new IntersectionObserver(
    (entries) => {
      // Process entries
      const newlyVisible = [];
      const newlyHidden = [];

      entries.forEach((entry) => {
        const commitId = entry.target.getAttribute("data-commit-id");
        const commit = filteredCommits.find((c) => c.id === commitId);

        if (!commit) return;

        if (entry.isIntersecting) {
          // Commit just became visible
          if (!visibleCommits.includes(commit)) {
            newlyVisible.push(commit);
          }
        } else {
          // Commit just became hidden
          if (visibleCommits.includes(commit)) {
            newlyHidden.push(commit);
          }
        }
      });

      // Update visibleCommits list
      visibleCommits = visibleCommits
        .filter((c) => !newlyHidden.includes(c))
        .concat(newlyVisible);

      // Determine scroll direction
      const scrollY = window.scrollY;
      const scrollingDown = scrollY > lastScrollY;
      lastScrollY = scrollY;

      // Update the scatterplot with transition based on visible commits
      if (newlyVisible.length > 0) {
        updateScatterplotWithActiveDay(scrollingDown);
      }
    },
    {
      threshold: 0.2, // Trigger when 20% of item is visible
      rootMargin: "-10% 0px -10% 0px", // Add margin to detect items near the viewport
    }
  );

  // Start observing all commit items
  document.querySelectorAll(".item").forEach((item) => {
    window.commitObserver.observe(item);
  });

  // Also observe day headers
  document.querySelectorAll(".day-header").forEach((header) => {
    window.commitObserver.observe(header);
  });
}

// Update scatterplot highlighting based on active day
function updateScatterplotWithActiveDay(scrollingDown) {
  if (!visibleCommits.length) return;

  // Get the day of currently visible commits
  const visibleDays = new Set(visibleCommits.map((c) => c.day));

  // Get all commits for visible days
  const commitsToHighlight = filteredCommits.filter((c) =>
    visibleDays.has(c.day)
  );

  // Update the scatterplot with transitions based on scroll direction
  updateScatterplotWithTransition(commitsToHighlight, scrollingDown);
}

// Create brush function
function brushed(event) {
  const brushSelection = event.selection;

  selectedCommits = !brushSelection
    ? [] // Clear selection if brush is cleared
    : filteredCommits.filter((commit) => {
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

  // Update files display based on selection
  displayCommitFiles();

  // Reset highlighting since we're using selection now
  if (selectedCommits.length > 0) {
    updateScatterplotHighlights([]);
  }
}

function createBrush(svg) {
  const brush = d3.brush().on("start brush end", brushed);

  // Add brush to existing brush group
  svg.select(".brush").call(brush);

  return brush;
}

function createScatterplot() {
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };

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
      
      circle.active {
        stroke: white;
        stroke-width: 2px;
      }
      
      .day-section {
        margin-bottom: 2rem;
        padding-top: 0.5rem;
      }
      
      .day-header {
        position: sticky;
        top: 0;
        background: white;
        margin: 0 0 1rem 0;
        padding: 0.5rem;
        border-bottom: 1px solid #eee;
        z-index: 100;
      }
      
      .commit-time {
        font-weight: bold;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }

  // Create and set up SVG container
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  // Create a group for the main content
  const mainGroup = svg.append("g").attr("class", "main-group");

  // Initialize scales with empty domains
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

// Enhanced scatterplot with smooth transitions
function updateScatterplotWithTransition(highlightCommits, scrollingDown) {
  // Get existing SVG
  let svg = d3.select("#chart svg");
  if (svg.empty()) return;

  const dots = svg.select(".dots");

  // Update active state for all circles
  dots
    .selectAll("circle")
    .classed("active", (d) => highlightCommits.includes(d))
    .transition()
    .duration(300)
    .style("fill-opacity", (d) => (highlightCommits.includes(d) ? 1 : 0.4));

  // Apply special effect for active commits based on scroll direction
  dots.selectAll("circle.active").each(function () {
    const circle = d3.select(this);
    const baseRadius = parseFloat(
      circle.attr("data-base-radius") || circle.attr("r")
    );

    circle
      .transition()
      .duration(400)
      .attr("r", baseRadius * 1.3) // Grow the circle
      .transition()
      .duration(300)
      .attr("r", baseRadius); // Return to original size
  });
}

// Highlight commits in the scatterplot
function updateScatterplotHighlights(highlights) {
  // If we have an active selection, don't highlight hover commits
  if (selectedCommits.length > 0) {
    return;
  }

  // If we have no highlights, reset all circles
  if (!highlights || highlights.length === 0) {
    d3.selectAll("circle")
      .style("fill-opacity", 0.7)
      .style("stroke", null)
      .style("stroke-width", null);
    return;
  }

  // Otherwise, highlight specific commits and dim others
  d3.selectAll("circle")
    .style("fill-opacity", (d) => (highlights.includes(d) ? 1 : 0.3))
    .style("stroke", (d) => (highlights.includes(d) ? "#fff" : null))
    .style("stroke-width", (d) => (highlights.includes(d) ? 2 : null));
}

// Standard scatterplot update function
function updateScatterplot(filteredData) {
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };

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
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 15]);

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
          .attr("data-base-radius", (d) => rScale(d.totalLines)) // Store base radius for animation
          .call((enter) =>
            enter
              .transition()
              .duration(300)
              .attr("r", (d) => rScale(d.totalLines))
          ),
      (update) =>
        update.call(
          (update) =>
            update
              .transition()
              .duration(300)
              .attr("cx", (d) => xScale(d.datetime))
              .attr("cy", (d) => yScale(d.hourFrac))
              .attr("r", (d) => rScale(d.totalLines))
              .attr("data-base-radius", (d) => rScale(d.totalLines)) // Update base radius
        ),
      (exit) =>
        exit.call((exit) =>
          exit.transition().duration(300).attr("r", 0).remove()
        )
    )
    .on("mouseenter", (event, commit) => {
      updateTooltipContent(commit);
      updateTooltipPosition(event);

      // Highlight this circle
      d3.select(event.target)
        .transition()
        .duration(200)
        .style("fill-opacity", 1)
        .attr("r", (d) => rScale(d.totalLines) * 1.2);

      // Highlight corresponding commit in the list
      highlightCommitInList(commit);
    })
    .on("mousemove", updateTooltipPosition)
    .on("mouseleave", (event) => {
      updateTooltipContent({});

      // Only reset if not an active commit
      const isActive = d3.select(event.target).classed("active");

      if (!isActive) {
        d3.select(event.target)
          .transition()
          .duration(200)
          .style("fill-opacity", 0.7)
          .attr("r", function () {
            return d3.select(this).attr("data-base-radius");
          });
      }

      // Remove highlight from list if no selection
      if (selectedCommits.length === 0) {
        d3.selectAll(".item").classed("highlighted", false);
      }
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

      // Update files display based on selection
      displayCommitFiles();

      // Update highlighting
      if (selectedCommits.length > 0) {
        updateScatterplotHighlights([]);
      }
    });

  // Update brush
  createBrush(svg);

  // Ensure brush is below dots
  svg.select(".brush").lower();

  // Set pointer-events properly for brush
  svg.select(".brush .overlay").style("pointer-events", "all");
  svg.select(".brush .selection").style("pointer-events", "none");

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
      .attr("transform", (d, i) => `translate(0, ${i * 30})`);

    legendItems
      .append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", (d) => rScale(d))
      .attr("fill", "#666")
      .style("fill-opacity", 0.7);

    legendItems
      .append("text")
      .attr("x", 25)
      .attr("y", 5)
      .text((d) => `${d} lines`)
      .attr("font-size", "12px")
      .attr("fill", "#666");
  }
}

// Highlight a commit in the list view when hovering over its circle
function highlightCommitInList(commit) {
  // Remove existing highlights
  d3.selectAll(".item").classed("highlighted", false);

  // Find the item for this commit and highlight it
  d3.selectAll(".item")
    .filter((d) => d && d.id === commit.id)
    .classed("highlighted", true);

  // Scroll to the commit if it's not in view
  const commitItem = document.querySelector(
    `.item[data-commit-id="${commit.id}"]`
  );
  if (commitItem) {
    // Check if element is in viewport
    const rect = commitItem.getBoundingClientRect();
    const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;

    // Scroll into view with behavior smooth if not visible
    if (!isInViewport) {
      commitItem.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }
}

function getTimeColor(hour) {
  if (hour < 6) return "#2c5282"; // Deep blue for night
  if (hour < 12) return "#ed8936"; // Orange for morning
  if (hour < 18) return "#ecc94b"; // Yellow for afternoon
  return "#4299e1"; // Light blue for evening
}

// Setup time slider
function setupTimeSlider() {
  const timeSlider = document.getElementById("time-slider");
  if (timeSlider) {
    timeSlider.value = commitProgress; // Set initial value to 100 (show all)

    timeSlider.addEventListener("input", function () {
      // Original functionality: filter commits by time
      commitProgress = Number(this.value);
      commitMaxTime = timeScale.invert(commitProgress);
      updateTimeDisplay();
    });
  }
}
