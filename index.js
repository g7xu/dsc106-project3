import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
// TODO 
// find another function for the actual .txt values to be overlayed on the heatmap
// convert the .txt files to svg/d3 friendly format

const width = window.innerWidth / 2;
const height = window.innerHeight / 2;
const gridWidth = 64;  // Change grid size to fit data later
const gridHeight = 32;

// Variables to hold color scales
const colorScale = d3.scaleQuantize()
  .domain([0, 1])
  .range(d3.schemeRdBu[9].reverse());



// Variables to hold data
var data_left = null;
var data_right = null;
var sleep_back = null;
var jsonData = null; // Declare jsonData globally

/**
 * Function to create a contour map using D3
 * @param {string} svgId - The ID of the SVG element
 * @param {Array} data - The data to be visualized
 * @param {function} colorScale - The color scale function
 * @returns {d3.ZoomBehavior} - The zoom behavior associated with the SVG, for external reset if needed.
 */
function createContourMap(svgId, data, colorScale) {
  const svg = d3.select(svgId)
    .attr("preserveAspectRatio", "xMinYMin meet");

  // Create or select a persistent group for the zoomable content
  let g = svg.select("g.zoom-container");
  if (g.empty()) {
    g = svg.append("g").attr("class", "zoom-container");
  }


  // Remove any existing tooltip for this chart
  // d3.select(`${svgId}-tooltip`).remove();


  // Create tooltip element
  //
  const tooltip = d3.select("body").append("div")
    // .attr("id", `${svgId}-tooltip`)
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("border-radius", "5px")
    .style("padding", "10px")
    .style("pointer-events", "none");

  // Render function that updates the group contents without removing the group itself
  function render() {
    const bbox = svg.node().getBoundingClientRect(); // Get actual size
    const width = bbox.width;
    const height = bbox.height;

    // Clear only the contents of the zoom container
    g.selectAll("*").remove();

    // Define a projection that ensures contours fit inside the SVG
    const scaleX = width / 32;
    const scaleY = height / 64;
    const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

    const projection = d3.geoIdentity().scale(scale);
    const path = d3.geoPath().projection(projection);

    // Normalize data for better visualization
    const dataMin = d3.min(data.flat());
    const dataMax = d3.max(data.flat());
    const normalizedData = data.map(row =>
      row.map(v => (v - dataMin) / Math.max(dataMax - dataMin, 1e-6))
    );

    // Generate contour data
    const contours = d3.contours()
      .size([32, 64])
      .thresholds(d3.range(0, 1.05, 0.025)) // Higher resolution
      (normalizedData.flat());

    // Define a color scale for the contour map
    const color = d3.scaleSequential(colorScale).domain([0, 1]);

    // Draw the contours within the group
    g.append("g")
      .attr("stroke", "black")
      .selectAll("path")
      .data(contours)
      .join("path")
      .attr("d", path)
      .attr("fill", d => color(d.value))
      .attr("stroke-width", 0.2)
      .on("mouseover", function(event, d) {
        tooltip.transition()
          .duration(200)
          .style("opacity", 0.9);
        tooltip.html("Pressure Value: " + (d.value * (dataMax - dataMin) + dataMin).toFixed(2) + " mmHg")
          .style("left", (event.pageX + 10 ) + "px")
          .style("top", (event.pageY - 38) + "px");
      })
      .on("mouseout", function() {
        tooltip.transition()
          .duration(500)
          .style("opacity", 0);
      });
  }

  // Initial render
  render();

  // Set up zoom functionality on the SVG but transform the group 'g'
  const zoom = d3.zoom()
    .scaleExtent([1, 10])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    })
    .on("zoom", (event) => {
      const transform = event.transform;

      // Get the bounding box of the SVG container
      const bbox = svg.node().getBoundingClientRect();
      const width = bbox.width;
      const height = bbox.height;

      // Calculate the limits for panning
      const xMin = Math.min(0, width - width * transform.k);
      const xMax = Math.max(0, width * (1 - transform.k));
      const yMin = Math.min(0, height - height * transform.k);
      const yMax = Math.max(0, height * (1 - transform.k));

      // Clamp translation values to prevent dragging out of bounds
      const clampedX = Math.max(xMin, Math.min(xMax, transform.x));
      const clampedY = Math.max(yMin, Math.min(yMax, transform.y));

      // Apply the constrained transformation
      g.attr("transform", `translate(${clampedX},${clampedY}) scale(${transform.k})`);
    });

svg.call(zoom);

  // Resize observer to update if the SVG dimensions change
  const resizeObserver = new ResizeObserver(() => {
    render();
  });
  resizeObserver.observe(svg.node());

  return zoom; // Return the zoom behavior for reset function
}

/**
 * Function to handle input changes on the weight and height
 */
function handleInputChange() {
    const weightElement = document.getElementById('weight-number');
    const heightElement = document.getElementById('height-number');
    const weightWarning = document.getElementById('weight-hint');
    const heightWarning = document.getElementById('height-hint');

    const weight = parseFloat(weightElement.value);
    const height = parseFloat(heightElement.value);

    if (isNaN(weight) || weight < 20 || weight > 150) {
      // change the text and color it red
      weightWarning.innerHTML = "<p style='color: lightcoral;'> Must be in 20 ~ 150</p>";
      weightElement.style.backgroundColor = 'lightcoral';
    } else {
      weightWarning.innerHTML = "<p> Enter Your Weight ↓</p>";
      weightElement.style.backgroundColor = '';
    }

    if (isNaN(height) || height < 130 || height > 250) {
      heightWarning.innerHTML = "<p style='color: lightcoral;'> Must be in 130 ~ 250</p>";
      heightElement.style.backgroundColor = 'lightcoral';
    } else {
      heightWarning.innerHTML = "<p> Enter Your Height ↓</p>";
      heightElement.style.backgroundColor = '';
    }

    // Finding the closest data point in the JSON data
    let closestDataPoint = null;
    let minDistance = Infinity;

    for (const [key, value] of Object.entries(jsonData)) {
        const float_weight = parseFloat(value.weight);
        const float_height = parseFloat(value.height);
        const distance = Math.sqrt((float_weight - weight) ** 2 + (float_height - height) ** 2);

        if (distance < minDistance) {
            minDistance = distance;
            closestDataPoint = [key, value];
        }
    }

    if (closestDataPoint) {
        updateCharts(jsonData, closestDataPoint[0]);
    }
}

/**
 * Function to update charts based on the selected subject
 * @param {Object} jsonData - The JSON data
 * @param {string} subjectKey - The key of the selected subject
 */
function updateCharts(jsonData, subjectKey) {
  d3.selectAll(".tooltip").remove();


  const subject = jsonData[subjectKey];
  createContourMap("#left", subject.Left, colorScale);
  createContourMap("#supine", subject.Supine, colorScale);
  createContourMap("#right", subject.Right, colorScale);
}

// Event listener for DOM content loaded
document.addEventListener("DOMContentLoaded", function () {
  fetch("data/experiment1_data.json")
    .then(response => response.json())
    .then(data => {
      jsonData = data; // Assign fetched data to global jsonData
      updateCharts(jsonData, "S1");
      createLegend(d3.interpolateRainbow);
      
      // Add event listeners to input fields for dynamic updates
      document.getElementById('weight-number').addEventListener('input', handleInputChange);
      document.getElementById('height-number').addEventListener('input', handleInputChange);

      // Add event listener to reset button
      document.querySelector('.reset').addEventListener('click', () => {
        // Reset the input values to their original numbers
        document.getElementById('weight-number').value = 120;
        document.getElementById('height-number').value = 160;
        // Reset the contour map to the default subject key "S1"
        updateCharts(jsonData, "S1");

        // Reset the zoom leve of the left SVG
        const svg = d3.select("#left");
        const zoom = createContourMap("#left", jsonData["S1"].Left, colorScale);
        svg.call(zoom.transform, d3.zoomIdentity);

        // Reset the zoom leve of the center SVG
        const svg2 = d3.select("#supine");
        const zoom2 = createContourMap("#supine", jsonData["S1"].Supine, colorScale);
        svg2.call(zoom2.transform, d3.zoomIdentity);

        // Reset the zoom leve of the right SVG
        const svg3 = d3.select("#right");
        const zoom3 = createContourMap("#right", jsonData["S1"].Right, colorScale);
        svg3.call(zoom3.transform, d3.zoomIdentity);

      }
      );
    });
});

/**
 * Resets the input fields, charts to default state (S1), and zoom levels.
 */
window.resetCharts = function(zoomLeft, zoomSupine, zoomRight) {
    // Reset the input values to their original numbers
    document.getElementById('weight-number').value = 120;
    document.getElementById('height-number').value = 160;

    // Reset the contour map to the default subject key "S1"
    updateCharts(jsonData, "S1");

    // Reset the zoom transform on the SVG elements
    const svgLeft = d3.select("#left");
    const svgSupine = d3.select("#supine");
    const svgRight = d3.select("#right");

    svgLeft.transition().duration(750).call(zoomLeft.transform, d3.zoomIdentity);
    svgSupine.transition().duration(750).call(zoomSupine.transform, d3.zoomIdentity);
    svgRight.transition().duration(750).call(zoomRight.transform, d3.zoomIdentity);
};

document.addEventListener("DOMContentLoaded", function () {
  fetch("data/experiment1_data.json")
    .then(response => response.json())
    .then(data => {
      jsonData = data; // Assign fetched data to global jsonData

      // Initialize charts and get zoom behaviors
      const zoomLeft = createContourMap("#left", jsonData["S1"].Left, colorScale);
      const zoomSupine = createContourMap("#supine", jsonData["S1"].Supine, colorScale);
      const zoomRight = createContourMap("#right", jsonData["S1"].Right, colorScale);

      // Add event listeners to input fields for dynamic updates
      document.getElementById('weight-number').addEventListener('input', handleInputChange);
      document.getElementById('height-number').addEventListener('input', handleInputChange);

      // Add event listener to reset button, now calling the resetCharts function
      document.querySelector('.reset').addEventListener('click', () => {
        window.resetCharts(zoomLeft, zoomSupine, zoomRight); // Call the reset function, passing zoom behaviors
      });
    });
});
function createLegend() {
  const scaleBox = d3.select(".scale-box");

  function renderLegend() {
    // Clear any existing SVG elements
    scaleBox.selectAll("svg").remove();

    const legendWidth = scaleBox.node().getBoundingClientRect().width - 20; // Adjust width dynamically, accounting for padding
    const legendHeight = 20;
    const marginLeft = 20; // Add margin to the left
    const marginRight = 30; // Add margin to the right

    const svg = scaleBox.append("svg")
      .attr("id", "legend-svg") // Add special id to the svg
      .attr("width", legendWidth + marginLeft + marginRight) // Adjust width to include left and right margins
      .attr("height", legendHeight + 30)
      .style("display", "block"); // Ensure the SVG is displayed as a block element

    const defs = svg.append("defs");
    
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");

    const stops = d3.range(0, 1.05, 0.2);
    stops.forEach(d => {
      gradient.append("stop")
        .attr("offset", `${d * 100}%`)
        .attr("stop-color", colorScale(d));
    });

    svg.append("rect")
      .attr("x", marginLeft) // Add margin to the left
      .attr("y", 10)
      .attr("width", legendWidth - marginLeft - marginRight) // Adjust width to account for left and right margins
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    const axisScale = d3.scaleLinear()
      .domain([0, 200])
      .range([marginLeft, legendWidth - marginRight]); // Adjust range to account for left and right margins

    const axis = d3.axisBottom(axisScale)
      .ticks(5)
      .tickFormat(d3.format(".2f"));

    const axisGroup = svg.append("g")
      .attr("transform", `translate(0, ${legendHeight + 10})`)
      .call(axis);

    // Increase the font size of the axis labels and ticks
    axisGroup.selectAll("text")
      .style("font-size", "14px") // Adjust the font size as needed
      .style("fill", "var(--color-light)"); // Change the text color to --color-light
  }

  // Initial render
  renderLegend();

  // Add resize event listener to re-render the legend on window resize
  window.addEventListener("resize", renderLegend);
}
