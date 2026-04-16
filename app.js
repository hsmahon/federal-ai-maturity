const STAGE_ORDER = ["Pre-deployment", "Pilot", "Deployed", "Retired"];
const STAGE_COLORS = {
  "Pre-deployment": "red",
  Pilot: "yellow",
  Deployed: "green",
  Retired: "neutral",
};
const STAGE_WEIGHTS = {
  "Pre-deployment": 0,
  Pilot: 0.7,
  Deployed: 1,
  Retired: 0,
};
const PAGE_SIZE = 5;
const PHONE_BREAKPOINT = 760;
const NARROW_PHONE_BREAKPOINT = 640;

const state = {
  dashboard: null,
  selectedAgency: null,
  page: 1,
};

function getEmbeddedDashboardData() {
  const node = document.querySelector("#dashboard-data");
  if (!node) {
    throw new Error("Embedded dashboard data is missing.");
  }
  return JSON.parse(node.textContent);
}

function init() {
  try {
    state.dashboard = getEmbeddedDashboardData();
    state.selectedAgency = null;
    render();
    window.addEventListener("resize", debounce(renderTreemap, 120));
    document.querySelector("#inventory-prev").addEventListener("click", showPreviousPage);
    document.querySelector("#inventory-next").addEventListener("click", showNextPage);
  } catch (error) {
    renderError(error);
  }
}

function render() {
  renderSummary();
  renderTreemap();
  renderAgencyDetail();
  renderUseCaseTable();
}

function renderSummary() {
  const { summary, agencies } = state.dashboard;
  const highImpactTotal = agencies.reduce(
    (total, agency) => total + agency.high_impact_count,
    0,
  );

  document.querySelector("#agency-count").textContent = formatNumber(summary.agency_count);
  document.querySelector("#use-case-count").textContent = formatNumber(
    summary.total_individual_use_cases,
  );
  document.querySelector("#cots-count").textContent = formatNumber(summary.total_cots_use_cases);
  document.querySelector("#high-impact-count").textContent = formatNumber(highImpactTotal);
}

function renderTreemap() {
  const container = document.querySelector("#treemap");
  const agencies = state.dashboard.agencies;
  container.innerHTML = "";

  const width = container.clientWidth || 960;
  const height = container.clientHeight || getTreemapFallbackHeight();
  const items = agencies.map((agency) => ({
    ...agency,
    value: Math.max(agency.total_footprint, 1),
  }));
  const layout = binaryTreemap(items, 0, 0, width, height);

  layout.forEach((item, index) => {
    const labelLayout = getTreemapLabelLayout(item);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `treemap-tile ${item.operational_maturity_bucket}`;
    if (item.agency === state.selectedAgency) {
      button.classList.add("active");
    }
    if (!labelLayout.showLabel) {
      button.classList.add("label-hidden");
    } else if (!labelLayout.showMeta) {
      button.classList.add("meta-hidden");
    }
    button.style.left = `${item.x}px`;
    button.style.top = `${item.y}px`;
    button.style.width = `${item.width}px`;
    button.style.height = `${item.height}px`;
    button.style.setProperty("--tile-font-size", `${labelLayout.fontSize}px`);
    button.setAttribute("role", "listitem");
    button.setAttribute(
      "aria-label",
      `${item.agency_name}, footprint ${item.total_footprint}, maturity ${item.operational_maturity_bucket}`,
    );
    button.innerHTML = `
      ${
        labelLayout.showLabel
          ? `<div><p class="treemap-title">${escapeHtml(item.display_code || item.agency)}</p></div>`
          : ""
      }
      ${
        labelLayout.showMeta
          ? `<p class="treemap-meta">
        <span>${formatNumber(item.total_footprint)} footprint</span>
        <span>${Math.round(item.operational_maturity_score * 100)} maturity</span>
      </p>`
          : ""
      }
    `;
    button.addEventListener("click", () => {
      selectAgency(item.agency);
    });
    container.appendChild(button);
  });
}

function getTreemapLabelLayout(item) {
  const label = item.display_code || item.agency;
  const isPhoneViewport = isPhoneViewportWidth();
  const isNarrowPhoneViewport = isNarrowPhoneViewportWidth();
  const inset = isNarrowPhoneViewport ? 12 : isPhoneViewport ? 14 : 18;
  const innerWidth = Math.max(item.width - inset, 0);
  const innerHeight = Math.max(item.height - inset, 0);
  const maxByWidth = innerWidth / Math.max(label.length * (isPhoneViewport ? 0.68 : 0.64), 1);
  const maxByHeight = innerHeight < 58
    ? innerHeight * (isPhoneViewport ? 0.34 : 0.44)
    : innerHeight * (isPhoneViewport ? 0.22 : 0.28);
  const minimumFontSize = isPhoneViewport ? 12 : 11;
  const fontSize = Math.max(
    Math.floor(Math.min(isPhoneViewport ? 22 : 28, maxByWidth, maxByHeight)),
    minimumFontSize,
  );
  const estimatedLabelWidth = fontSize * label.length * 0.62;
  const showLabel =
    innerWidth >= (isNarrowPhoneViewport ? 48 : isPhoneViewport ? 54 : 34) &&
    innerHeight >= (isPhoneViewport ? 28 : 20) &&
    fontSize >= minimumFontSize &&
    estimatedLabelWidth <= innerWidth * (isPhoneViewport ? 0.96 : 1);
  const showMeta = !isPhoneViewport && showLabel && innerWidth >= 92 && innerHeight >= 70;
  return { showLabel, showMeta, fontSize };
}

function renderAgencyDetail() {
  const agency = getActiveAgencyView();
  const isAllAgenciesView = agency.agency === null;
  const stageCounts = agency.stage_counts;
  const totalStageCount = STAGE_ORDER.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0);
  const title = document.querySelector("#agency-title");
  const subtitle = document.querySelector("#agency-subtitle");

  title.textContent = isAllAgenciesView ? "All agencies" : agency.agency_name;
  subtitle.textContent = isAllAgenciesView
    ? `${formatNumber(agency.total_footprint)} total footprint across ${formatNumber(state.dashboard.summary.agency_count)} agencies, individual reporting, and consolidated COTS.`
    : `${formatNumber(agency.total_footprint)} total footprint across individual reporting and consolidated COTS.`;

  document.querySelector("#metric-total").textContent = formatNumber(agency.total_footprint);
  document.querySelector("#metric-individual").textContent = formatNumber(
    agency.individual_use_case_count,
  );
  document.querySelector("#metric-cots").textContent = formatNumber(agency.cots_count);
  document.querySelector("#metric-deployed").textContent = formatNumber(stageCounts.Deployed || 0);
  document.querySelector("#metric-pilot").textContent = formatNumber(stageCounts.Pilot || 0);
  document.querySelector("#metric-pre").textContent = formatNumber(stageCounts["Pre-deployment"] || 0);
  document.querySelector("#metric-high-impact").textContent = formatNumber(
    agency.high_impact_count,
  );

  document.querySelector("#maturity-label").textContent = agency.stage_data_available
    ? `${agency.operational_maturity_bucket.toUpperCase()} · ${Math.round(
        agency.operational_maturity_score * 100,
      )}`
    : "No stage data";
  document.querySelector("#maturity-copy").textContent = agency.stage_data_available
    ? isAllAgenciesView
      ? "Stage score uses deployed = 1.0, pilot = 0.7, and pre-deployment = 0.0 across all individually reported agency stages."
      : "Stage score uses deployed = 1.0, pilot = 0.7, and pre-deployment = 0.0."
    : "This agency only reported consolidated COTS activity or no individual stage data.";

  renderGauge(agency);
  renderBars(
    document.querySelector("#stage-breakdown"),
    STAGE_ORDER.map((stage) => ({
      label: stage,
      value: stageCounts[stage] || 0,
      width: totalStageCount ? ((stageCounts[stage] || 0) / totalStageCount) * 100 : 0,
      color: STAGE_COLORS[stage],
    })),
  );

  const topicEntries = Object.entries(agency.topic_counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const topicMax = topicEntries.length ? topicEntries[0][1] : 0;
  renderBars(
    document.querySelector("#topic-breakdown"),
    topicEntries.length
      ? topicEntries.map(([label, value]) => ({
          label,
          value,
          width: topicMax ? (value / topicMax) * 100 : 0,
          color: "neutral",
        }))
      : [{ label: "No topic data", value: 0, width: 0, color: "neutral" }],
  );
}

function renderGauge(agency) {
  const svg = document.querySelector("#maturity-gauge");
  const score = agency.stage_data_available ? agency.operational_maturity_score : 0.5;
  const angle = -90 + score * 180;
  const needleColor = agency.stage_data_available
    ? agency.operational_maturity_bucket
    : "neutral";

  svg.innerHTML = `
    <defs>
      <filter id="needle-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)" />
      </filter>
    </defs>
    <path d="M24 126 A96 96 0 0 1 80 42" fill="none" stroke="#9f3a39" stroke-width="26" stroke-linecap="round"></path>
    <path d="M80 42 A96 96 0 0 1 160 42" fill="none" stroke="#b28528" stroke-width="26" stroke-linecap="round"></path>
    <path d="M160 42 A96 96 0 0 1 216 126" fill="none" stroke="#2d7a4a" stroke-width="26" stroke-linecap="round"></path>
    <path d="M36 126 A84 84 0 0 1 204 126" fill="none" stroke="rgba(10,18,16,0.92)" stroke-width="18"></path>
    <g transform="translate(120 126) rotate(${angle})" filter="url(#needle-shadow)">
      <path d="M-5 0 L0 -74 L5 0 Z" fill="${gaugeNeedleColor(needleColor)}"></path>
      <path d="M-8 4 Q0 -10 8 4 L0 18 Z" fill="rgba(232,242,238,0.2)"></path>
    </g>
    <circle cx="120" cy="126" r="18" fill="#0f1d19" stroke="rgba(232,242,238,0.12)" stroke-width="2"></circle>
    <circle cx="120" cy="126" r="8" fill="${gaugeNeedleColor(needleColor)}"></circle>
  `;
}

function renderBars(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${escapeHtml(item.label)}</span>
      <div class="bar-track">
        <div class="bar-fill ${item.color}" style="width:${item.width}%"></div>
      </div>
      <strong>${formatNumber(item.value)}</strong>
    `;
    container.appendChild(row);
  });
}

function renderUseCaseTable() {
  const tbody = document.querySelector("#use-case-table");
  const useCases = getActiveUseCases();
  const isAllAgenciesView = state.selectedAgency === null;
  const totalPages = Math.max(Math.ceil(useCases.length / PAGE_SIZE), 1);
  state.page = Math.min(state.page, totalPages);
  const startIndex = (state.page - 1) * PAGE_SIZE;
  const pageItems = useCases.slice(startIndex, startIndex + PAGE_SIZE);

  document.querySelector("#inventory-count").textContent = useCases.length
    ? isAllAgenciesView
      ? `${formatNumber(useCases.length)} use cases across all agencies`
      : `${formatNumber(useCases.length)} use cases`
    : "No use cases reported";
  document.querySelector("#inventory-page-summary").textContent = useCases.length
    ? `Page ${state.page} of ${totalPages}`
    : "Page 0 of 0";
  document.querySelector("#inventory-prev").disabled = state.page === 1;
  document.querySelector("#inventory-next").disabled = state.page === totalPages;

  tbody.innerHTML = "";
  if (!pageItems.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6" class="empty-state">No use cases are available for this agency.</td>`;
    tbody.appendChild(row);
    return;
  }

  pageItems.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td data-label="Use case">
        ${isAllAgenciesView ? `<span class="use-case-context">${escapeHtml(item.agency || "Unknown agency")}</span>` : ""}
        <span class="use-case-name">${escapeHtml(item.use_case_name || "Untitled use case")}</span>
        <span class="use-case-subtext">${escapeHtml(item.problem_solved || item.benefits || "No summary provided")}</span>
      </td>
      <td data-label="Stage"><span class="pill stage-pill ${stagePillClass(item.development_stage)}">${escapeHtml(item.development_stage || "Unknown")}</span></td>
      <td data-label="Topic">${escapeHtml(item.topic_area || "Unspecified")}</td>
      <td data-label="Classification">${escapeHtml(item.classification || "Unspecified")}</td>
      <td data-label="Bureau">${escapeHtml(item.agency_bureau || "Unspecified")}</td>
      <td data-label="High-impact"><span class="pill impact-pill ${impactPillClass(item.is_high_impact)}">${escapeHtml(item.is_high_impact || "Not high-impact")}</span></td>
    `;
    tbody.appendChild(row);
  });
}

function selectAgency(agency) {
  state.selectedAgency = state.selectedAgency === agency ? null : agency;
  state.page = 1;
  render();
  scrollSelectedAgencyIntoView();
}

function showPreviousPage() {
  if (state.page > 1) {
    state.page -= 1;
    renderUseCaseTable();
  }
}

function showNextPage() {
  const useCases = state.dashboard.use_cases[state.selectedAgency] || [];
  const totalPages = Math.max(Math.ceil(useCases.length / PAGE_SIZE), 1);
  if (state.page < totalPages) {
    state.page += 1;
    renderUseCaseTable();
  }
}

function getActiveAgencyView() {
  if (!state.selectedAgency) {
    return buildAllAgenciesView();
  }

  return (
    state.dashboard.agencies.find((agency) => agency.agency === state.selectedAgency) ||
    buildAllAgenciesView()
  );
}

function buildAllAgenciesView() {
  const stageCounts = Object.fromEntries(STAGE_ORDER.map((stage) => [stage, 0]));
  const topicCounts = {};
  let totalFootprint = 0;
  let individualUseCaseCount = 0;
  let cotsCount = 0;
  let highImpactCount = 0;

  state.dashboard.agencies.forEach((agency) => {
    totalFootprint += agency.total_footprint;
    individualUseCaseCount += agency.individual_use_case_count;
    cotsCount += agency.cots_count;
    highImpactCount += agency.high_impact_count;

    STAGE_ORDER.forEach((stage) => {
      stageCounts[stage] += agency.stage_counts[stage] || 0;
    });

    Object.entries(agency.topic_counts).forEach(([label, value]) => {
      topicCounts[label] = (topicCounts[label] || 0) + value;
    });
  });

  const score = computeMaturityScore(stageCounts);
  return {
    agency: null,
    agency_name: "All agencies",
    total_footprint: totalFootprint,
    individual_use_case_count: individualUseCaseCount,
    cots_count: cotsCount,
    stage_counts: stageCounts,
    stage_data_available: individualUseCaseCount > 0,
    high_impact_count: highImpactCount,
    topic_counts: topicCounts,
    operational_maturity_score: score,
    operational_maturity_bucket: classifyMaturityBucket(score),
  };
}

function getActiveUseCases() {
  if (state.selectedAgency) {
    return state.dashboard.use_cases[state.selectedAgency] || [];
  }

  return Object.values(state.dashboard.use_cases)
    .flat()
    .slice()
    .sort(
      (left, right) =>
        left.agency.localeCompare(right.agency) ||
        left.use_case_name.localeCompare(right.use_case_name),
    );
}

function binaryTreemap(items, x, y, width, height) {
  if (!items.length) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, y, width, height }];
  }

  const sorted = [...items].sort((left, right) => right.value - left.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  let splitIndex = 1;
  let running = sorted[0].value;

  while (splitIndex < sorted.length - 1 && running < total / 2) {
    running += sorted[splitIndex].value;
    splitIndex += 1;
  }

  const first = sorted.slice(0, splitIndex);
  const second = sorted.slice(splitIndex);
  const firstValue = first.reduce((sum, item) => sum + item.value, 0);
  const ratio = total ? firstValue / total : 0.5;

  if (width >= height) {
    const splitWidth = Math.round(width * ratio);
    return [
      ...binaryTreemap(first, x, y, splitWidth, height),
      ...binaryTreemap(second, x + splitWidth, y, width - splitWidth, height),
    ];
  }

  const splitHeight = Math.round(height * ratio);
  return [
    ...binaryTreemap(first, x, y, width, splitHeight),
    ...binaryTreemap(second, x, y + splitHeight, width, height - splitHeight),
  ];
}

function gaugeNeedleColor(color) {
  if (color === "green") return "#d2f2cb";
  if (color === "yellow") return "#f7dd9b";
  if (color === "neutral") return "#dce6e2";
  return "#f2c5bf";
}

function computeMaturityScore(stageCounts) {
  const relevantTotal = STAGE_ORDER.reduce((sum, stage) => sum + (stageCounts[stage] || 0), 0);
  if (!relevantTotal) {
    return 0;
  }

  const weightedTotal = STAGE_ORDER.reduce(
    (sum, stage) => sum + (stageCounts[stage] || 0) * STAGE_WEIGHTS[stage],
    0,
  );
  return weightedTotal / relevantTotal;
}

function classifyMaturityBucket(score) {
  if (score < 0.3) return "red";
  if (score < 0.78) return "yellow";
  return "green";
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function stagePillClass(stage) {
  if (stage === "Deployed") return "green";
  if (stage === "Pilot") return "yellow";
  if (stage === "Pre-deployment") return "red";
  return "neutral";
}

function impactPillClass(status) {
  return status === "High-impact" ? "red" : "neutral";
}

function getTreemapFallbackHeight() {
  if (isNarrowPhoneViewportWidth()) return 360;
  if (isPhoneViewportWidth()) return 420;
  return 640;
}

function isPhoneViewportWidth() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function isNarrowPhoneViewportWidth() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function scrollSelectedAgencyIntoView() {
  if (!window.matchMedia("(max-width: 760px)").matches) {
    return;
  }
  const detailPanel = document.querySelector(".detail-panel");
  if (!detailPanel) {
    return;
  }
  window.requestAnimationFrame(() => {
    detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function debounce(fn, delay) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}

function renderError(error) {
  document.body.innerHTML = `
    <main class="dashboard-shell">
      <section class="masthead">
        <p class="eyebrow">Embedded data error</p>
        <h1>Dashboard data is unavailable in this page.</h1>
        <p class="masthead-copy">${escapeHtml(error.message)}</p>
      </section>
    </main>
  `;
}

init();
