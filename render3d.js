// render3d.js — Three.js scene, camera, lights, body-mesh sync.
'use strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

export class Renderer3D {
  constructor({ canvas, hostEl }) {
    this.canvas = canvas;
    this.hostEl = hostEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1d28');
    this.scene.fog = new THREE.Fog('#1a1d28', 30, 80);

    // Camera — OrbitControls will manage orientation after construction.
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    this.camera.position.set(0, 4.5, 22);

    // Tone mapping for richer visuals.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Lights.
    this.scene.add(new THREE.HemisphereLight(0x99aaff, 0x222233, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(8, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -12; key.shadow.camera.right = 12;
    key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
    this.scene.add(key);

    // Playfield: floor + side walls visible, front+back invisible Z-clamps.
    this._buildPlayfield();

    // Orbit controls — right-drag to orbit, scroll to zoom, middle-drag to pan.
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.target.set(0, 3, 0);
    this.controls.minDistance = 5;
    this.controls.maxDistance = 60;
    this.controls.update();

    this.bodyMeshes = new Map(); // rapier RigidBody → Three.Mesh

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  _buildPlayfield() {
    const W = 24, H = 9, D = 12; // wide open arena — no back wall
    this.playfield = { W, H, D };

    const floorMat = new THREE.MeshStandardMaterial({ color: '#252a38', roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, D), floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid overlay on the floor surface.
    const grid = new THREE.GridHelper(W, 24, 0x2a3050, 0x22273a);
    grid.position.y = 0.001;
    this.scene.add(grid);

    // Side walls — thin, visible only when needed for ball containment.
    const sideGeom = new THREE.BoxGeometry(0.3, H, D);
    const sideL = new THREE.Mesh(sideGeom, new THREE.MeshStandardMaterial({ color: '#1e2230', roughness: 0.95 }));
    sideL.position.set(-W / 2 - 0.15, H / 2, 0);
    this.scene.add(sideL);
    const sideR = sideL.clone();
    sideR.position.x = W / 2 + 0.15;
    this.scene.add(sideR);
    // No back wall — open arena so objects fall naturally into view.
  }

  _onResize() {
    const r = this.hostEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- mesh<->body sync -----------------------------------------------------

  addBodyMesh(rb) {
    const mesh = this._meshForBody(rb);
    if (!mesh) return;
    mesh.castShadow = true;
    this.bodyMeshes.set(rb, mesh);
    this.scene.add(mesh);
  }

  removeBodyMesh(rb) {
    const m = this.bodyMeshes.get(rb);
    if (m) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
      this.bodyMeshes.delete(rb);
    }
  }

  _meshForBody(rb) {
    const u = rb.userData || {};
    const color = u.color || '#888';
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    const c = rb.collider(0);
    let geom;
    switch (u.kind) {
      case 'cube': {
        const he = c.halfExtents();
        geom = new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2);
        break;
      }
      case 'sphere': {
        geom = new THREE.SphereGeometry(c.radius(), 24, 16);
        break;
      }
      case 'cylinder': {
        const r = c.radius(), hh = c.halfHeight();
        geom = new THREE.CylinderGeometry(r, r, hh * 2, 24);
        break;
      }
      case 'capsule': {
        const r = c.radius(), hh = c.halfHeight();
        geom = new THREE.CapsuleGeometry(r, hh * 2, 8, 16);
        break;
      }
      case 'prism': {
        // Reconstruct from spec data attached to userData.
        const { sides, radius, depth } = u;
        const shape = new THREE.Shape();
        for (let i = 0; i <= sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
          if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        geom.translate(0, 0, -depth / 2);
        break;
      }
      case 'wall': {
        const he = c.halfExtents();
        geom = new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2);
        return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: '#4a5068', roughness: 0.9 }));
      }
      default:
        return null;
    }
    return new THREE.Mesh(geom, mat);
  }

  syncMeshes() {
    for (const [rb, mesh] of this.bodyMeshes) {
      const t = rb.translation();
      const q = rb.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.controls.dispose();
    for (const [, mesh] of this.bodyMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.renderer.dispose();
  }
}
