let map;
let marker;
let riskChart;
let lastAnalysisData = null; // Store data for report generation

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initChart();
    initNavigation();
    
    // Event Listeners
    document.getElementById('search-btn').addEventListener('click', handleSearch);
    document.getElementById('location-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    document.getElementById('export-pdf-btn').addEventListener('click', exportPremiumPDF);
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const searchBar = document.getElementById('app-search-bar');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.id.replace('btn-', 'section-');
            
            // Update nav active state
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Show target section
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // Hide search bar on non-dashboard pages
            if (targetId === 'section-dashboard') {
                searchBar.style.display = 'flex';
            } else {
                searchBar.style.display = 'none';
            }
        });
    });
}

function initMap() {
    // Default to a global view
    map = L.map('map').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        analyzeLocation(lat, lng);
    });
}

function initChart() {
    const ctx = document.getElementById('riskChart').getContext('2d');
    riskChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Earthquake', 'Flood', 'Rainfall'],
            datasets: [{
                label: 'Risk Level',
                data: [0, 0, 0],
                backgroundColor: 'rgba(45, 212, 191, 0.2)',
                borderColor: '#2dd4bf',
                pointBackgroundColor: '#2dd4bf',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#f8fafc', font: { size: 14 } },
                    ticks: { display: false, max: 100, min: 0 }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

async function handleSearch() {
    const query = document.getElementById('location-input').value;
    if (!query) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            
            map.setView([latitude, longitude], 10);
            analyzeLocation(latitude, longitude);
            document.getElementById('location-input').value = display_name;
        } else {
            alert('Location not found.');
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

async function analyzeLocation(lat, lon) {
    // Update marker
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lon]).addTo(map);

    // Show loading state
    setLoading(true);

    try {
        const response = await fetch(`/api/analyze?lat=${lat}&lon=${lon}`);
        const result = await response.json();
        
        lastAnalysisData = result; // Store for report
        updateUI(result);
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Failed to analyze location. Ensure the backend is running.');
    } finally {
        setLoading(false);
    }
}

function updateUI(data) {
    // Update Core Scores
    document.getElementById('eq-score').innerText = data.breakdown.earthquake.score;
    document.getElementById('flood-score').innerText = data.breakdown.flood.score;
    document.getElementById('rain-score').innerText = data.breakdown.rainfall.score;
    
    // Update Gauge
    const gaugeFill = document.getElementById('risk-gauge');
    const scoreText = document.getElementById('risk-score-text');
    const rotation = (data.overall_score / 100) * 0.5; // 0 to 0.5 turns
    
    gaugeFill.style.transform = `rotate(${rotation}turn)`;
    scoreText.innerText = Math.round(data.overall_score);
    
    const badge = document.getElementById('risk-level-badge');
    badge.innerText = `${data.risk_level} Risk`;
    
    // Badge colors
    if (data.overall_score > 70) badge.style.backgroundColor = 'var(--danger)';
    else if (data.overall_score > 40) badge.style.backgroundColor = 'var(--warning)';
    else badge.style.backgroundColor = 'var(--success)';

    // Update Recommendations
    const list = document.getElementById('recommendations-list');
    list.innerHTML = '';
    data.recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.innerText = rec;
        list.appendChild(li);
    });

    // Update Chart
    riskChart.data.datasets[0].data = [
        data.breakdown.earthquake.score,
        data.breakdown.flood.score,
        data.breakdown.rainfall.score
    ];
    riskChart.update();
}

function setLoading(isLoading) {
    const btn = document.getElementById('search-btn');
    const input = document.getElementById('location-input');
    if (isLoading) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        document.body.style.cursor = 'wait';
        input.disabled = true;
    } else {
        btn.innerHTML = '<i class="fas fa-search"></i>';
        document.body.style.cursor = 'default';
        input.disabled = false;
    }
}

async function exportPremiumPDF() {
    if (!lastAnalysisData) {
        alert('Please analyze a location first before exporting a report.');
        return;
    }

    try {
        console.log("Generating report...");
        // Populate the hidden template
        document.getElementById('report-id').innerText = 'DR' + Date.now().toString().slice(-6);
        document.getElementById('report-date').innerText = new Date().toLocaleDateString();
        document.getElementById('report-location').innerText = document.getElementById('location-input').value || 
                                                              `${lastAnalysisData.location.lat}, ${lastAnalysisData.location.lon}`;
        
        document.getElementById('report-overall-score').innerText = Math.round(lastAnalysisData.overall_score);
        const riskLevelEl = document.getElementById('report-risk-level');
        const riskInsightEl = document.getElementById('report-risk-insight');
        riskLevelEl.innerText = lastAnalysisData.risk_level.toUpperCase() + ' RISK';
        
        // Risk level styling and insights
        if (lastAnalysisData.overall_score > 70) {
            riskLevelEl.style.background = '#ef4444';
            riskInsightEl.innerText = "CRITICAL: Significant disaster risks detected. This site requires specialized deep foundations, seismic dampers, and advanced flood protection infrastructure.";
        } else if (lastAnalysisData.overall_score > 40) {
            riskLevelEl.style.background = '#f59e0b';
            riskInsightEl.innerText = "CAUTION: Moderate environmental risks present. Routine construction is permissible but elevated foundation levels and reinforced masonry are recommended.";
        } else {
            riskLevelEl.style.background = '#10b981';
            riskInsightEl.innerText = "SAFE: Environmental variables are within stable limits. Standard construction practices and local building codes are sufficient for this location.";
        }

        // Detailed scores
        document.getElementById('report-eq-score').innerText = lastAnalysisData.breakdown.earthquake.score;
        document.getElementById('report-eq-meta').innerText = lastAnalysisData.breakdown.earthquake.count + ' seismic events';
        
        document.getElementById('report-flood-score').innerText = lastAnalysisData.breakdown.flood.score;
        document.getElementById('report-flood-meta').innerText = 'River discharge: ' + lastAnalysisData.breakdown.flood.max_discharge_m3s + ' m3/s';
        
        document.getElementById('report-rain-score').innerText = lastAnalysisData.breakdown.rainfall.score;
        document.getElementById('report-rain-meta').innerText = 'Max precip: ' + lastAnalysisData.breakdown.rainfall.max_daily_mm + ' mm';

        // Recommendations
        const reportRecs = document.getElementById('report-recommendations');
        reportRecs.innerHTML = '';
        lastAnalysisData.recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.innerText = rec;
            reportRecs.appendChild(li);
        });

        // Template is currently at -9999px. We need to prepare it for capture.
        const element = document.getElementById('premium-report-template');
        console.log("Preparing high-resolution capture...");

        // Ensure template is accessible for capture but hidden from user
        element.style.position = 'fixed';
        element.style.left = '0';
        element.style.top = '0';
        element.style.zIndex = '-100'; // Way behind
        element.style.visibility = 'visible';
        element.style.display = 'block';

        const canvasOptions = {
            scale: 2, // High resolution
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            letterRendering: true,
            allowTaint: false
        };

        // Manual capture loop for maximum local file reliability
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(element, canvasOptions);
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                
                // jsPDF Manual construction
                const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                
                // Add the captured image to the PDF
                pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
                
                // Final save
                const filename = `Disaster_Report_Moawia_${Date.now().toString().slice(-4)}.pdf`;
                pdf.save(filename);

                // Return template to safe state
                element.style.position = 'absolute';
                element.style.left = '-9999px';
                console.log("Report exported successfully via direct capture.");
            } catch (err) {
                console.error("Manual PDF Generation Error:", err);
                alert("Critical error generating report: " + err.message);
                element.style.position = 'absolute';
                element.style.left = '-9999px';
            }
        }, 1000);

    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + error.message);
    }
}
