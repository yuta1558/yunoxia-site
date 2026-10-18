// 3D point cloud for the profile space. Loaded only when profiles.csv exists,
// the figure is on screen, WebGL works, and motion is allowed.
import * as THREE from 'three';

type Point = [cooling: number, flow: number, temp: number, group: number];

export function mountProfileSpace(root: HTMLElement) {
  const points: Point[] = JSON.parse(root.dataset.points ?? '[]');
  if (points.length === 0) return;

  const fallback = root.querySelector<SVGElement>('.fallback');
  const style = getComputedStyle(document.documentElement);
  const palette = ['--accent', '--fg', '--muted', '--accent'].map(
    (v) => new THREE.Color(style.getPropertyValue(v).trim() || '#888'),
  );

  // Normalise each physical axis to [-1, 1]
  const norm = (i: 0 | 1 | 2) => {
    const vals = points.map((p) => p[i]);
    const min = Math.min(...vals);
    const span = Math.max(...vals) - min || 1;
    return (v: number) => ((v - min) / span) * 2 - 1;
  };
  const nx = norm(0);
  const ny = norm(1);
  const nz = norm(2);

  const positions = new Float32Array(points.length * 3);
  const colors = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    positions.set([nx(p[0]) * 1.6, ny(p[1]), nz(p[2])], i * 3);
    const c = palette[p[3] % palette.length];
    colors.set([c.r, c.g, c.b], i * 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true, opacity: 0.8 });
  const cloud = new THREE.Points(geometry, material);

  // The cooling axis (x) explains most of the machine-to-machine variance: draw it as a line
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.8, -1.1, 0), new THREE.Vector3(1.8, -1.1, 0)]),
    new THREE.LineBasicMaterial({ color: palette[0] }),
  );

  const scene = new THREE.Scene();
  scene.add(cloud, axis);
  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 50);
  camera.position.set(0, 0.4, 4.2);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return; // keep the 2D fallback
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  fallback?.setAttribute('hidden', '');
  fallback?.parentElement?.insertBefore(canvas, fallback);

  // Drag to rotate around the vertical axis; otherwise the cloud stays still
  let yaw = -0.5;
  let dragging = false;
  let lastX = 0;

  const render = () => {
    cloud.rotation.y = yaw;
    axis.rotation.y = yaw;
    renderer.render(scene, camera);
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  new ResizeObserver(resize).observe(canvas);

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
    render();
  });
  canvas.addEventListener('pointerup', () => (dragging = false));

  resize();
}
