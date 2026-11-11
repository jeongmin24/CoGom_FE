import { useCallback, useLayoutEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MathUtils, Vector3 } from 'three';
import { useRoomStore } from './roomStore';

export const MIN_ROOM_ZOOM = 14;
export const MAX_ROOM_ZOOM = 280;

export interface CameraCommand {
  kind: 'in' | 'out' | 'reset' | 'self';
  id: number;
}

interface RoomCameraProps {
  command: CameraCommand | null;
  onZoomChange: (zoom: number) => void;
}

const clampZoom = (zoom: number) => MathUtils.clamp(zoom, MIN_ROOM_ZOOM, MAX_ROOM_ZOOM);

export function RoomCamera({ command, onZoomChange }: RoomCameraProps) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousFit = useRef<number | null>(null);
  const handledCommand = useRef<number | null>(null);
  const lastReportedZoom = useRef<number | null>(null);
  const zoomCallback = useRef(onZoomChange);
  zoomCallback.current = onZoomChange;

  const reportZoom = useCallback(() => {
    if (lastReportedZoom.current === camera.zoom) return;
    lastReportedZoom.current = camera.zoom;
    zoomCallback.current(camera.zoom);
  }, [camera]);

  const updateView = useCallback(() => {
    camera.updateProjectionMatrix();
    controls.current?.update();
    invalidate();
    // Direct camera changes do not always emit an OrbitControls change event.
    reportZoom();
  }, [camera, invalidate, reportZoom]);

  useLayoutEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    const fit = clampZoom(Math.min(size.width / 16, size.height / 10));
    const magnification = previousFit.current === null ? 1 : camera.zoom / previousFit.current;
    if (previousFit.current === null) controls.current?.target.set(0, 1, 0);
    previousFit.current = fit;
    camera.zoom = clampZoom(fit * magnification);
    updateView();
  }, [camera, size.width, size.height, updateView]);

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!command || command.id === handledCommand.current || !orbit || size.width <= 0 || size.height <= 0) return;
    handledCommand.current = command.id;

    if (command.kind === 'in' || command.kind === 'out') {
      camera.zoom = clampZoom(camera.zoom * (command.kind === 'in' ? 1.3 : 1 / 1.3));
    } else {
      const viewOffset = camera.position.clone().sub(orbit.target);
      // Flush residual orbit damping before an explicit reposition, so the
      // requested framing remains still after the toolbar button is released.
      const damping = orbit.enableDamping;
      orbit.enableDamping = false;
      orbit.update();
      orbit.enableDamping = damping;

      if (command.kind === 'reset') {
        orbit.target.set(0, 1, 0);
        camera.position.set(11, 11, 15);
        camera.zoom = clampZoom(Math.min(size.width / 16, size.height / 10));
      } else {
        const state = useRoomStore.getState();
        const me = state.players.find(player => player.id === state.myId);
        if (!me) return;
        const target = new Vector3(me.position[0], 0.9, me.position[1]);
        orbit.target.copy(target);
        camera.position.copy(target).add(viewOffset);
        camera.zoom = clampZoom(Math.min(180, size.height / 2.2));
      }
    }

    updateView();
  }, [camera, command, size.width, size.height, updateView]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      keyEvents={false}
      zoomToCursor
      minZoom={MIN_ROOM_ZOOM}
      maxZoom={MAX_ROOM_ZOOM}
      minPolarAngle={0.55}
      maxPolarAngle={1.18}
      minAzimuthAngle={-0.1}
      maxAzimuthAngle={1.25}
      onChange={reportZoom}
    />
  );
}
