// static/js/graficas.js

document.addEventListener('DOMContentLoaded', function() {
    const labels = window.ventasFechas;
    const data = {
        labels: labels,
        datasets: [{
            label: 'Ventas por día',
            data: window.ventasPorDia,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2
        }]
    };
    const config = {
        type: 'bar',
        data: data,
        options: {
            scales: {
                y: { beginAtZero: true }
            }
        }
    };
    new Chart(document.getElementById('ventasChart'), config);
});
