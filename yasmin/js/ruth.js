// Ruth: the soldier who was "the new one" before you. Her five cassette tapes, her ghost,
// the missing poster, and the secret ending when every tape has been found.
import * as THREE from 'three';
import { lineOfSight, opaque } from './map.js';

export const TAPES = [
  null,
  { night: 1, title: 'קלטת 1 · רות', lines: ['קלטת אחת. קוראים לי רות.', 'אני... החדשה. השאירו אותי לבד בבסיס לסופ״ש.', 'יש פה בחורה. יסמין. היא מנקה כל הלילה. כל הלילה.', 'אני שומעת את הגלגלים של הדלי מתחת לדלת.'] },
  { night: 2, title: 'קלטת 2 · רות', lines: ['קלטת שתיים. ניסיתי לדבר איתה.', 'היא הסתכלה על הנעליים שלי ואמרה: "לכלכת".', 'מאז היא הולכת אחריי.', 'אם היא רואה אותך — תשבור קו ראייה. תתחבא בלוקר.', 'רק שהיא לא תראה אותך נכנס.'] },
  { night: 3, title: 'קלטת 3 · רות', lines: ['קלטת שלוש. מצאתי את נבו. הוא בבידוד.', 'הוא סופר. ארבעים ושבע.', 'הוא אמר לי שיש ארבעה מפתחות לשער, ושהיא מחביאה אותם בבסיס.', 'אחד היא תמיד שומרת אצלה. בדלי.'] },
  { night: 4, title: 'קלטת 4 · רות', lines: ['קלטת ארבע. יש לי שלושה מפתחות.', 'היא לקחה לי את הנעליים. אני הולכת יחפה על הרטוב... זה קר.', 'מחר אני בורחת. דרך המבוך.', 'אם אני לא... אם מישהו מוצא את הקלטות — תמשיך מאיפה שעצרתי.'] },
  { night: 5, title: 'קלטת 5 · רות', lines: ['קלטת חמש. אני במבוך.', 'המסדרונות... זזים. אני שומעת גלגלים מכל הכיוונים.', 'היא שרה. היא...', 'היא מאחוריי. היא מאחו—'] },
];

// Where each night's tape lies.
export const TAPE_SPOTS = [null, [2.85, 0.53, 6.85], [40.7, 1.43, 16.45], [62.2, 0.84, 36.4], [61.0, 0.12, 2.75], [27.2, 0.05, 42.7]];

// Ruth's ghost appears at these spots on the way through the maze on the last night.
export const MAZE_GUIDE = [[29, 31], [27, 35], [31, 39], [37, 41]];

export function loadTapes() { try { return new Set(JSON.parse(localStorage.getItem('yasmin5.tapes') || '[]')); } catch (e) { return new Set(); } }
export function saveTapes(s) { try { localStorage.setItem('yasmin5.tapes', JSON.stringify([...s])); } catch (e) { } }

export function tapeMesh(M) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.064), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 }));
  g.add(shell);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshStandardMaterial({ color: 0xe9e0c2, roughness: 0.8 }));
  label.rotation.x = -Math.PI / 2; label.position.set(0, 0.0065, -0.008); g.add(label);
  for (const x of [-0.022, 0.022]) {
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 10), new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.5 }));
    reel.position.set(x, 0, 0.012); g.add(reel);
  }
  // a little red tag so it stands out
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.013, 0.01), M.red); tag.position.set(0.04, 0, -0.03); g.add(tag);
  return g;
}

export class Ghost {
  constructor(scene, tex) {
    const img = tex.image;
    const h = 1.72, w = h * img.width / img.height;
    this.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, fog: true, color: 0xb8c4cc });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.mesh.geometry.translate(0, h / 2, 0);
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.target = 0; this.t = 0;
  }
  show(x, z, opacity = 0.85) { this.mesh.position.set(x, 0.02, z); this.mesh.visible = true; this.target = opacity; this.t = 0; }
  hide(fast = false) { this.target = 0; if (fast) { this.mat.opacity = 0; this.mesh.visible = false; } }
  get shown() { return this.mesh.visible && this.target > 0; }
  update(dt, t, cam) {
    if (!this.mesh.visible) return;
    this.t += dt;
    // face the camera around the vertical axis, with a faint sway and flicker
    this.mesh.rotation.y = Math.atan2(cam.position.x - this.mesh.position.x, cam.position.z - this.mesh.position.z);
    const flick = Math.sin(t * 23) * Math.sin(t * 7.7) > 0.8 ? 0.4 : 1;
    const k = Math.min(1, dt * (this.target > this.mat.opacity ? 1.2 : 4));
    this.mat.opacity += (this.target * flick - this.mat.opacity) * k;
    this.mesh.position.y = 0.02 + Math.sin(t * 1.3) * 0.015;
    if (this.target === 0 && this.mat.opacity < 0.02) this.mesh.visible = false;
  }
  // visible to the player right now?
  seenBy(p) { return this.mesh.visible && lineOfSight(p.x, p.z, this.mesh.position.x, this.mesh.position.z, opaque); }
}

// Draws the missing-person poster with her photo.
export function missingPosterTex(photo) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 720;
  const g = c.getContext('2d');
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, 512, 720);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.direction = 'rtl';
  g.font = '900 96px Heebo, Arial'; g.fillText('נעדרת', 256, 100);
  const s = Math.min(300 / photo.width, 340 / photo.height);
  const w = photo.width * s, h = photo.height * s;
  g.drawImage(photo, 256 - w / 2, 130, w, h);
  g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(256 - w / 2, 130, w, h);
  g.font = '800 54px Heebo, Arial'; g.fillText('רות ל.', 256, 540);
  g.font = '500 26px Heebo, Arial';
  g.fillText('נראתה לאחרונה במשמרת לילה,', 256, 590);
  g.fillText('ליד המבוך, לפני שלושה חודשים.', 256, 625);
  g.fillStyle = '#8a0b0b'; g.font = '700 26px Heebo, Arial';
  g.fillText('מי שראה — שלא יחפש.', 256, 675);
  // grime and tape
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 720, 10 + Math.random() * 60, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(230,220,170,0.7)'; g.fillRect(200, -6, 112, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
