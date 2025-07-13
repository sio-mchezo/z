// Main App
document.addEventListener('DOMContentLoaded', async () => {
  // Load all data
  const [entities, relationships, timeline] = await Promise.all([
    fetch('data/entities.json').then(r => r.json()),
    fetch('data/relationships.json').then(r => r.json()),
    fetch('data/timeline.json').then(r => r.json()).catch(() => null)
  ]);

  // Initialize network
  const container = document.getElementById('mynetwork');
  const nodeInfoEl = document.getElementById('node-info');
  let network, allNodes, allEdges;

  // Initialize UI
  initFilters(entities);
  initExportButtons();
  if (timeline) initTimeline(timeline);

  // Create initial network
  updateNetwork(2023);

  // ===== Core Functions =====
  function updateNetwork(year) {
    const nodes = createNodes(entities, year);
    const edges = createEdges(relationships, year);
    
    allNodes = new vis.DataSet(nodes);
    allEdges = new vis.DataSet(edges);
    
    const data = { nodes: allNodes, edges: allEdges };
    const options = getNetworkOptions();
    
    if (network) {
      network.destroy();
    }
    
    network = new vis.Network(container, data, options);
    setupEventHandlers();
  }

  function createNodes(entities, year) {
    return Object.entries(entities).map(([id, entity]) => {
      const revenueData = entity.financials.revenue;
      const revenue = revenueData[year] || revenueData[Object.keys(revenueData).pop()];
      
      return {
        id,
        label: entity.core.name,
        title: generateTooltip(entity, year),
        group: entity.core.sector,
        value: (entity.financials.marketDominance || 0.1) * 50,
        year,
        hidden: false,
        revenue
      };
    });
  }

  function createEdges(relationships, year) {
    return Object.entries(relationships).flatMap(([source, targets]) => 
      targets
        .filter(rel => !rel.years || rel.years.includes(year))
        .map(rel => ({
          from: source,
          to: rel.target,
          label: rel.type,
          arrows: rel.type === 'supplier' ? 'to' : '',
          dashes: rel.type === 'competitor',
          color: getEdgeColor(rel.type),
          width: 2
        }))
    );
  }

  function getNetworkOptions() {
    return {
      nodes: {
        shape: 'dot',
        font: { color: '#fff', size: 14 },
        borderWidth: 2
      },
      edges: {
        smooth: { type: 'continuous' },
        font: { size: 12, strokeWidth: 0 }
      },
      groups: {
        'Military & Defense': { color: '#ff3333' },
        'Technology': { color: '#33cc33' },
        'Investment': { color: '#3399ff' },
        'Banking': { color: '#ffcc00' }
      },
      physics: {
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true
      }
    };
  }

  // ===== Feature Implementations =====
  
  // 1. Search & Filter
  function initFilters(entities) {
    const searchInput = document.getElementById('search');
    const sectorFilter = document.getElementById('sector-filter');
    
    // Populate sector filter
    const sectors = [...new Set(Object.values(entities).map(e => e.core.sector))];
    sectors.forEach(sector => {
      const option = document.createElement('option');
      option.value = sector;
      option.textContent = sector;
      sectorFilter.appendChild(option);
    });
    
    // Event listeners
    searchInput.addEventListener('input', filterNodes);
    sectorFilter.addEventListener('change', filterNodes);
  }

  function filterNodes() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const sector = document.getElementById('sector-filter').value;
    
    allNodes.forEach(node => {
      const matchesSearch = node.label.toLowerCase().includes(searchTerm);
      const matchesSector = !sector || node.group === sector;
      
      network.updateClusteredNode(node.id, {
        hidden: !(matchesSearch && matchesSector)
      });
    });
  }

  // 2. Timeline Animation
  function initTimeline(timelineData) {
    const slider = document.getElementById('year-slider');
    const yearDisplay = document.getElementById('year-display');
    
    slider.min = Math.min(...timelineData.years);
    slider.max = Math.max(...timelineData.years);
    slider.value = slider.max;
    
    slider.addEventListener('input', () => {
      const year = parseInt(slider.value);
      yearDisplay.textContent = year;
      updateNetwork(year);
    });
  }

  // 3. Export Functions
  function initExportButtons() {
    document.getElementById('export-png').addEventListener('click', exportPNG);
    document.getElementById('export-svg').addEventListener('click', exportSVG);
  }

  function exportPNG() {
    html2canvas(container).then(canvas => {
      const link = document.createElement('a');
      link.download = `network-${new Date().toISOString()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  function exportSVG() {
    network.storePositions();
    const svg = network.toSVG();
    const link = document.createElement('a');
    link.download = `network-${new Date().toISOString()}.svg`;
    link.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    link.click();
  }

  // ===== Helpers =====
  function generateTooltip(entity, year) {
    return `
      <div class="node-tooltip">
        <h3>${entity.core.name}</h3>
        <p><strong>Sector:</strong> ${entity.core.sector}</p>
        <p><strong>Country:</strong> ${entity.core.country}</p>
        <p><strong>Revenue (${year}):</strong> 
          ${entity.financials.revenue[year] || 'N/A'} 
          ${entity.financials.revenue.currency}</p>
      </div>
    `;
  }

  function getEdgeColor(type) {
    const colors = {
      'competitor': '#ff3333',
      'supplier': '#33cc33',
      'investment': '#3399ff',
      'default': '#cccccc'
    };
    return colors[type] || colors.default;
  }

  function setupEventHandlers() {
    network.on('click', params => {
      if (params.nodes.length) {
        const nodeId = params.nodes[0];
        const node = allNodes.get(nodeId);
        showNodeDetails(node);
      }
    });
  }

  function showNodeDetails(node) {
    const entity = entities[node.id];
    nodeInfoEl.innerHTML = `
      <div class="node-details">
        <h2>${entity.core.name}</h2>
        <span class="sector-tag" style="background: ${getGroupColor(entity.core.sector)}">
          ${entity.core.sector}
        </span>
        <p><strong>Country:</strong> ${entity.core.country}</p>
        <p><strong>Revenue (${node.year}):</strong> 
          ${entity.financials.revenue[node.year] || 'N/A'} 
          ${entity.financials.revenue.currency}</p>
        <p><strong>Market Dominance:</strong> 
          ${(entity.financials.marketDominance * 100).toFixed(1)}%</p>
        ${entity.core.description ? `<p>${entity.core.description}</p>` : ''}
      </div>
    `;
  }

  function getGroupColor(sector) {
    const colors = {
      'Military & Defense': '#ff3333',
      'Technology': '#33cc33',
      'Investment': '#3399ff',
      'default': '#666666'
    };
    return colors[sector] || colors.default;
  }
});