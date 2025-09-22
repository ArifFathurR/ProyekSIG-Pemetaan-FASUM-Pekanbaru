import 'ol/ol.css'; // Mengimpor CSS OpenLayers
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat } from 'ol/proj';
import { Vector as VectorSource } from 'ol/source';
import VectorLayer from 'ol/layer/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Icon } from 'ol/style';
import Overlay from 'ol/Overlay';
import OSM from 'ol/source/OSM';

// Popup Overlay
const container = document.getElementById('popup');
const contentElement = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');
const infoElement = document.getElementById('info'); // Mendefinisikan infoElement
const kategoriContainer = document.getElementById('kategori-container');
const tingkatKerusakanContainer = document.getElementById('tingkatkerusakan-container');

const overlay = new Overlay({
  element: container,
  autoPan: {
    animation: { duration: 250 },
  },
});

// Daftar warna untuk polygon PKU
const colorMap = [
  'rgba(255, 99, 132, 0.5)', // Merah muda
  'rgba(54, 162, 235, 0.5)', // Biru
  'rgba(75, 192, 192, 0.5)', // Hijau cyan
  'rgba(255, 206, 86, 0.5)', // Kuning
  'rgba(153, 102, 255, 0.5)', // Ungu
  'rgba(255, 159, 64, 0.5)', // Oranye
  'rgba(0, 128, 128, 0.5)', // Teal
  'rgba(128, 0, 128, 0.5)', // Ungu tua
];

// Style dinamis untuk PKU berdasarkan FID
const getStyleByID = (feature) => {
  const id = feature.get('FID') || 0; // Ambil ID dari atribut GeoJSON
  const color = colorMap[id % colorMap.length]; // Pilih warna berdasarkan ID
  return new Style({
    fill: new Fill({ color: color }), // Warna isi polygon
    stroke: new Stroke({ color: '#333', width: 1.5 }), // Garis tepi polygon
  });
};

// Layer PKU (Polygon)
const pkuLayer = new VectorLayer({
  source: new VectorSource({
    url: 'data/pku.json',
    format: new GeoJSON(),
  }),
  style: getStyleByID,
});

// Layer Fasilitas Umum (Point)
const fasilitasSource = new VectorSource({
  url: 'data/DataFasilitasRusak.json',
  format: new GeoJSON(),
});

const fasilitasLayer = new VectorLayer({
  source: fasilitasSource,
  style: new Style({
    image: new Icon({
      anchor: [0.5, 46],
      anchorXUnits: 'fraction',
      anchorYUnits: 'pixels',
      src: 'icon/fasum.png',
      width: 32,
      height: 32,
    }),
  }),
});

// Overlay untuk Highlight Polygon
const highlightStyle = new Style({
  fill: new Fill({ color: 'rgba(255, 255, 255, 0.3)' }), // Transparansi tinggi
  stroke: new Stroke({ color: '#ffcc33', width: 3 }),
});

const highlightLayer = new VectorLayer({
  source: new VectorSource(),
  map: null, // Layer ini akan ditambahkan ke map saat diperlukan
  style: highlightStyle,
});

// Map Initialization
const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    pkuLayer,       // Layer PKU (Polygon)
    fasilitasLayer, // Layer Fasilitas Umum (Point)
  ],
  overlays: [overlay],
  view: new View({
    center: fromLonLat([101.4478, 0.5071]),
    zoom: 12,
  }),
});

// Set zIndex untuk mengatur prioritas rendering
fasilitasLayer.setZIndex(10); // Memastikan fasilitasLayer berada di atas
highlightLayer.setZIndex(5); // Highlight berada di bawah fasilitasLayer

map.addLayer(highlightLayer);

// Event Pointer Move untuk Highlight dan Info Kelurahan
let lastFeature = null;

map.on('pointermove', (evt) => {
  if (evt.dragging) {
    return;
  }

  const pixel = map.getEventPixel(evt.originalEvent);
  const feature = map.forEachFeatureAtPixel(pixel, (feat, layer) => {
    if (layer === pkuLayer || layer === fasilitasLayer) {
      return feat;
    }
    return null;
  });

  // Hapus highlight sebelumnya
  if (lastFeature !== feature) {
    if (lastFeature) {
      highlightLayer.getSource().clear();
    }

    // Tambahkan fitur baru ke highlight
    if (feature) {
      highlightLayer.getSource().addFeature(feature);

      // Tampilkan info nama kelurahan atau fasilitas
      const props = feature.getProperties();
      if (feature.getGeometry().getType() === 'Point') {
        infoElement.innerHTML =
          `<strong>${props.Tempat || 'Nama Tidak Diketahui'}</strong><br>` +
          `<em>${props.Kategori || 'Kategori Tidak Diketahui'}</em>`;
      } else {
        infoElement.innerHTML = props.name || 'Nama Kelurahan Tidak Diketahui';
      }
    } else {
      infoElement.innerHTML = '&nbsp;';
    }

    lastFeature = feature;
  }
});

// Tambahkan utilitas untuk mendapatkan layer dari fitur
map.getLayerForFeature = (feature) => {
  const layers = [pkuLayer, fasilitasLayer];
  return layers.find((layer) =>
    layer.getSource().hasFeature(feature)
  );
};

// Popup Handler
map.on('singleclick', (evt) => {
  const feature = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);

  if (feature) {
    const coords = feature.getGeometry().getCoordinates();
    const props = feature.getProperties();

    // Memastikan informasi yang ditampilkan meliputi gambar
    let content = `<h3>${props.Tempat || 'Tidak Ada Nama'}</h3>`;
    content += `<p><strong>Kategori:</strong> ${props.Kategori}</p>`;
    content += `<p><strong>Tingkat Kerusakan:</strong> ${props.Tingkat_Ke}</p>`;

    // Menambahkan gambar jika tersedia
    if (props.Gambar) {
      content += `<img src="images/${props.Gambar}" alt="${props.Tempat}" style="max-width:200px; height:auto;" />`;
    }

    contentElement.innerHTML = content;
    overlay.setPosition(coords);
  } else {
    overlay.setPosition(undefined);
  }
});

// Tombol Penutup Popup
closer.onclick = () => {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

// Filter berdasarkan kategori dan tingkat kerusakan
fasilitasSource.once('change', () => {
  if (fasilitasSource.getState() === 'ready') {
    const kategoriSet = new Set();
    const tingkatKerusakanSet = new Set();

    fasilitasSource.forEachFeature((feature) => {
      kategoriSet.add(feature.get('Kategori'));
      tingkatKerusakanSet.add(feature.get('Tingkat_Ke'));
    });

    // Filter kategori
    kategoriSet.forEach((kategori) => {
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="checkbox" value="${kategori}" checked> ${kategori}
      `;
      kategoriContainer.appendChild(label);

      label.querySelector('input').addEventListener('change', () => {
        applyFilters();
      });
    });

    // Filter tingkat kerusakan
    tingkatKerusakanSet.forEach((tingkatKerusakan) => {
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="checkbox" value="${tingkatKerusakan}" checked> Tingkat Kerusakan ${tingkatKerusakan}
      `;
      tingkatKerusakanContainer.appendChild(label);

      label.querySelector('input').addEventListener('change', () => {
        applyFilters();
      });
    });

    const applyFilters = () => {
      const checkedCategories = Array.from(
        kategoriContainer.querySelectorAll('input:checked')
      ).map((input) => input.value);

      const checkedTingkatKerusakan = Array.from(
        tingkatKerusakanContainer.querySelectorAll('input:checked')
      ).map((input) => input.value);

      fasilitasSource.forEachFeature((feature) => {
        const kategori = feature.get('Kategori');
        const tingkatKerusakan = feature.get('Tingkat_Ke');
        const visible =
          checkedCategories.includes(kategori) &&
          checkedTingkatKerusakan.includes(tingkatKerusakan);
        feature.setStyle(visible ? null : new Style());
      });
    };
  }
});

// Kontrol visibilitas layer
document.getElementById('polygon').addEventListener('change', (e) => {
  pkuLayer.setVisible(e.target.checked);
});

document.getElementById('point').addEventListener('change', (e) => {
  fasilitasLayer.setVisible(e.target.checked);
});
