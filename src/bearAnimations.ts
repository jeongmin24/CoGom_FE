import { AnimationClip, Box3, Group, Mesh, NumberKeyframeTrack, Vector3, type Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export type StudyStyle = 'writing' | 'headphones' | 'thinking' | 'reading' | 'typing';
export const studyLabels: Record<StudyStyle, string> = {
  writing: '필기 중', headphones: '음악과 집중', thinking: '생각 정리', reading: '독서 중', typing: '타이핑 중',
};

function pivotParts(scene: Group, name: string, names: string[], position?: [number, number, number]) {
  const parts = names.map(part => scene.getObjectByName(part)).filter((part): part is Object3D => Boolean(part));
  if (!parts[0]?.parent) return null;
  const pivot = new Group();
  pivot.name = name;
  if (position) pivot.position.set(...position);
  else pivot.position.copy(parts[0].position);
  parts[0].parent.add(pivot);
  scene.updateMatrixWorld(true);
  for (const part of parts) pivot.attach(part);
  return pivot;
}

function track(name: string, duration: number, values: number[]) {
  const times = values.map((_, index) => index * duration / (values.length - 1));
  return new NumberKeyframeTrack(name, times, values);
}

function studyClip(style: StudyStyle) {
  const duration = style === 'typing' ? 0.8 : style === 'writing' ? 1.4 : 4;
  const poses = {
    typing: { left: [-0.70, -0.94, -0.70, -0.94, -0.70], right: [-0.94, -0.70, -0.94, -0.70, -0.94], head: [0.04, 0.055, 0.04], tilt: [0, 0.012, 0] },
    writing: { left: [-0.60, -0.60], right: [-0.87, -1.02, -0.88, -0.98, -0.87], head: [0.06, 0.08, 0.06], tilt: [0.025, 0.04, 0.025] },
    headphones: { left: [-0.35, -0.42, -0.35], right: [-0.35, -0.42, -0.35], head: [0, 0.055, 0], tilt: [-0.035, 0.035, -0.035] },
    thinking: { left: [-0.25, -0.25], right: [-1.35, -1.49, -1.35], head: [-0.035, 0.025, -0.035], tilt: [-0.085, -0.045, -0.085] },
    reading: { left: [-0.93, -0.98, -0.93], right: [-0.98, -1.14, -0.98], head: [0.055, 0.09, 0.055], tilt: [-0.012, 0.012, -0.012] },
  }[style];
  return new AnimationClip('Study_' + style, duration, [
    track('BearMotion.rotation[x]', duration, poses.head),
    track('BearMotion.rotation[z]', duration, poses.tilt),
    track('LeftArm.rotation[x]', duration, poses.left),
    track('RightArm.rotation[x]', duration, poses.right),
    track('RightArm.rotation[y]', duration, style === 'writing' ? [-0.08, 0.08, -0.08] : [0, 0]),
    track('LeftLeg.rotation[x]', duration, [-1.12, -1.12]),
    track('RightLeg.rotation[x]', duration, [-1.12, -1.12]),
  ]);
}

export function prepareBear(source: Group) {
  const model = clone(source) as Group;
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const leftArm = pivotParts(model, 'LeftArm', ['Arm_L', 'Arm_L001', 'Microfiber_silhouette001']);
  const rightArm = pivotParts(model, 'RightArm', ['Arm_R001', 'Microfiber_silhouette003']);
  const leftLeg = pivotParts(model, 'LeftLeg', ['Haunch_L', 'Foot_L', 'Microfiber_silhouette002'], [-0.54, 0.72, 0]);
  const rightLeg = pivotParts(model, 'RightLeg', ['Haunch_R', 'Foot_R', 'Microfiber_silhouette004'], [0.54, 0.72, 0]);
  model.traverse(object => {
    if (object instanceof Mesh) {
      object.castShadow = !object.name.startsWith('Microfiber');
      object.receiveShadow = true;
    }
  });
  const supportedNodes = new Set(['BearMotion', leftArm?.name, rightArm?.name, leftLeg?.name, rightLeg?.name]);
  const clips = [
    ...(['writing', 'headphones', 'thinking', 'reading', 'typing'] as StudyStyle[]).map(studyClip),
    new AnimationClip('Rest', 4, [
      track('BearMotion.rotation[x]', 4, [0.035, 0.06, 0.035]),
      track('BearMotion.rotation[z]', 4, [0.045, 0.075, 0.045]),
      track('LeftArm.rotation[x]', 4, [0, 0.035, 0]),
      track('RightArm.rotation[x]', 4, [0, 0.035, 0]),
      track('RightArm.rotation[y]', 4, [0, 0]),
      track('LeftLeg.rotation[x]', 4, [0, 0]),
      track('RightLeg.rotation[x]', 4, [0, 0]),
    ]),
    new AnimationClip('Knock', 1.6, [
      new NumberKeyframeTrack('BearMotion.rotation[x]', [0, 0.18, 0.33, 0.48, 0.63, 0.78, 1.04, 1.6], [0, 0.07, 0.04, 0.07, 0.04, 0.07, 0.04, 0]),
      track('BearMotion.rotation[z]', 1.6, [0, 0]),
      track('LeftArm.rotation[x]', 1.6, [0, 0]),
      new NumberKeyframeTrack('RightArm.rotation[x]', [0, 0.18, 0.33, 0.48, 0.63, 0.78, 1.04, 1.6], [0, -1.1, -0.48, -1.1, -0.48, -1.1, -0.48, 0]),
      track('RightArm.rotation[y]', 1.6, [0, 0]),
      track('LeftLeg.rotation[x]', 1.6, [0, 0]),
      track('RightLeg.rotation[x]', 1.6, [0, 0]),
    ]),
  ];
  // Replacement assets can omit a limb. Exclude bindings for those nodes.
  for (const clip of clips) clip.tracks = clip.tracks.filter(item => supportedNodes.has(item.name.split('.')[0]));
  return { model, rightArm, scale: 1.55 / Math.max(size.y, 0.001), offset: [-center.x, -bounds.min.y, -center.z] as [number, number, number], clips };
}
