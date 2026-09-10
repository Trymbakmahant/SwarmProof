"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SPECIALIST_AGENTS, type SpecialistAgentMeta } from "./agentData";

interface SwarmSimulation3DProps {
  activeAgentId?: string | null;
  onSelectAgent: (agentId: string) => void;
  isAuditing?: boolean;
  auditPhase?: string;
  agents?: Record<string, SpecialistAgentMeta>;
  onOpenRegisterModal?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: (fullscreen: boolean) => void;
}

interface AgentMeshNode {
  agentId: string;
  meta: SpecialistAgentMeta;
  group: THREE.Group;
  primaryMesh: THREE.Mesh;
  accentMesh?: THREE.Mesh | THREE.Group;
  wireframeMesh?: THREE.LineSegments | THREE.Mesh;
  basePosition: THREE.Vector3;
  orbitAngle: number;
  rotationSpeed: { x: number; y: number; z: number };
  color: string;
}

interface DataPacket {
  mesh: THREE.Mesh;
  curve: THREE.QuadraticBezierCurve3;
  progress: number;
  speed: number;
  color: THREE.Color;
}

export function SwarmSimulation3D({
  activeAgentId,
  onSelectAgent,
  isAuditing = false,
  auditPhase = "idle",
  agents = SPECIALIST_AGENTS,
  onOpenRegisterModal,
  isFullscreen: propIsFullscreen,
  onToggleFullscreen,
}: SwarmSimulation3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredAgent, setHoveredAgent] = useState<SpecialistAgentMeta | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState(true);
  const [activeBeams, setActiveBeams] = useState(isAuditing);
  const [internalFullscreen, setInternalFullscreen] = useState(false);

  const isFullscreen = propIsFullscreen !== undefined ? propIsFullscreen : internalFullscreen;

  const toggleFullscreen = async () => {
    const nextState = !isFullscreen;
    setInternalFullscreen(nextState);
    onToggleFullscreen?.(nextState);

    try {
      if (nextState) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        }
      }
    } catch {
      // Fallback handled seamlessly by CSS fixed overlay
    }
  };

  // Sync state with native browser fullscreen changes (e.g. user pressed Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFull = !!document.fullscreenElement;
      if (!isNativeFull && isFullscreen) {
        setInternalFullscreen(false);
        onToggleFullscreen?.(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isFullscreen, onToggleFullscreen]);

  // Keyboard shortcut: Esc to exit, F to toggle fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.key === "Escape" && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setInternalFullscreen(false);
        onToggleFullscreen?.(false);
      } else if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, onToggleFullscreen]);

  // Sync beam activity with audit state
  useEffect(() => {
    setActiveBeams(isAuditing);
  }, [isAuditing]);

  // Trigger resize dispatch on fullscreen toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 60);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── 1. Scene & Camera Setup ──────────────────────────────────────
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060911, 0.022);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const initialCamDistance = 26;
    let cameraTheta = Math.PI / 4;
    let cameraPhi = Math.PI / 3.2;
    let cameraRadius = initialCamDistance;

    function updateCameraPosition() {
      camera.position.x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
      camera.position.y = cameraRadius * Math.cos(cameraPhi);
      camera.position.z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
      camera.lookAt(0, 0, 0);
    }
    updateCameraPosition();

    // ── 2. WebGL Renderer ────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // ── 3. Starfield & Background Ambient Particles ──────────────────
    const starGeo = new THREE.BufferGeometry();
    const starCount = 450;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 80;
      starPos[i + 1] = (Math.random() - 0.5) * 60;
      starPos[i + 2] = (Math.random() - 0.5) * 80;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x5a7ca5,
      size: 0.4,
      transparent: true,
      opacity: 0.65,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ── 4. Lighting ──────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x18263d, 1.8);
    scene.add(ambientLight);

    const coreLight = new THREE.PointLight(0x2dd4bf, 4, 35);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const topDirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    topDirLight.position.set(10, 20, 15);
    scene.add(topDirLight);

    // ── 5. Consensus Core (Centerpiece) ──────────────────────────────
    const coreGroup = new THREE.Group();

    // Inner glowing core
    const coreGeo = new THREE.IcosahedronGeometry(2.0, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0f2922,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.85,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Core outer wireframe lattice
    const coreWireGeo = new THREE.IcosahedronGeometry(2.2, 1);
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: 0x5eead4,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const coreWireMesh = new THREE.Mesh(coreWireGeo, coreWireMat);
    coreGroup.add(coreWireMesh);

    // Dual rotating equatorial rings
    const ring1Geo = new THREE.TorusGeometry(3.2, 0.04, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.7 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 2.3;
    coreGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(3.6, 0.03, 16, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI / 3;
    ring2.rotation.y = Math.PI / 6;
    coreGroup.add(ring2);

    scene.add(coreGroup);

    // ── 6. Construct The Specialist Agent 3D Meshes (Dynamic Registry) ──
    const agentNodes: AgentMeshNode[] = [];
    const specialistKeys = Object.keys(agents);
    const orbitRadius = 11.5;

    specialistKeys.forEach((key, index) => {
      const meta = agents[key]!;
      const angle = (index / specialistKeys.length) * Math.PI * 2;
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const y = Math.sin(angle * 2) * 1.2; // slight organic wave elevation

      const agentGroup = new THREE.Group();
      agentGroup.position.set(x, y, z);
      agentGroup.userData = { agentId: key };

      let primaryMesh: THREE.Mesh;
      let accentMesh: THREE.Mesh | THREE.Group | undefined;
      let wireframeMesh: THREE.Mesh | undefined;

      const colorHex = new THREE.Color(meta.color);
      const colorSec = new THREE.Color(meta.colorSecondary);

      // Distinct geometry per specialist domain
      switch (meta.shape) {
        case "octahedron": {
          // Reentrancy: Diamond Octahedron
          const geo = new THREE.OctahedronGeometry(1.6, 0);
          const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorSec,
            emissiveIntensity: 0.5,
            roughness: 0.25,
            metalness: 0.8,
          });
          primaryMesh = new THREE.Mesh(geo, mat);

          // Inner inverted octahedron
          const innerGeo = new THREE.OctahedronGeometry(0.9, 0);
          const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 });
          accentMesh = new THREE.Mesh(innerGeo, innerMat);
          agentGroup.add(accentMesh);
          break;
        }

        case "dodecahedron": {
          // Access Control: Dodecahedron Aegis (Shield)
          const geo = new THREE.DodecahedronGeometry(1.5, 0);
          const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorSec,
            emissiveIntensity: 0.6,
            roughness: 0.3,
            metalness: 0.85,
          });
          primaryMesh = new THREE.Mesh(geo, mat);

          // Outer shield facet wireframe
          const wireGeo = new THREE.DodecahedronGeometry(1.7, 0);
          const wireMat = new THREE.MeshBasicMaterial({ color: 0xffea00, wireframe: true, transparent: true, opacity: 0.4 });
          wireframeMesh = new THREE.Mesh(wireGeo, wireMat);
          agentGroup.add(wireframeMesh);
          break;
        }

        case "torusKnot": {
          // Business Logic: Mobius / Torus Knot
          const geo = new THREE.TorusKnotGeometry(1.0, 0.32, 64, 16, 2, 3);
          const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorSec,
            emissiveIntensity: 0.7,
            roughness: 0.2,
            metalness: 0.9,
          });
          primaryMesh = new THREE.Mesh(geo, mat);
          break;
        }

        case "icosahedron": {
          // Economic Security: Crystalline Diamond
          const geo = new THREE.IcosahedronGeometry(1.6, 0);
          const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorSec,
            emissiveIntensity: 0.65,
            roughness: 0.15,
            metalness: 0.9,
            flatShading: true,
          });
          primaryMesh = new THREE.Mesh(geo, mat);

          const haloGeo = new THREE.IcosahedronGeometry(1.85, 1);
          const haloMat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7, wireframe: true, transparent: true, opacity: 0.35 });
          wireframeMesh = new THREE.Mesh(haloGeo, haloMat);
          agentGroup.add(wireframeMesh);
          break;
        }

        case "gyroscope":
        default: {
          // Static Scanner: Hex Prism + Gyro Rings
          const geo = new THREE.CylinderGeometry(1.3, 1.3, 0.4, 6);
          const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorSec,
            emissiveIntensity: 0.6,
            roughness: 0.3,
            metalness: 0.8,
          });
          primaryMesh = new THREE.Mesh(geo, mat);

          const gyroGroup = new THREE.Group();
          const r1 = new THREE.Mesh(
            new THREE.TorusGeometry(1.8, 0.05, 16, 32),
            new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.65 }),
          );
          r1.rotation.x = Math.PI / 2;
          const r2 = new THREE.Mesh(
            new THREE.TorusGeometry(2.1, 0.04, 16, 32),
            new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5 }),
          );
          r2.rotation.y = Math.PI / 2;
          gyroGroup.add(r1);
          gyroGroup.add(r2);
          accentMesh = gyroGroup;
          agentGroup.add(accentMesh);
          break;
        }
      }

      primaryMesh.userData = { agentId: key };
      agentGroup.add(primaryMesh);

      // Add hovering ambient point light per agent
      const pLight = new THREE.PointLight(colorHex, 1.5, 8);
      agentGroup.add(pLight);

      scene.add(agentGroup);

      agentNodes.push({
        agentId: key,
        meta,
        group: agentGroup,
        primaryMesh,
        accentMesh,
        wireframeMesh,
        basePosition: new THREE.Vector3(x, y, z),
        orbitAngle: angle,
        rotationSpeed: {
          x: 0.008 + (index % 3) * 0.004,
          y: 0.012 + (index % 2) * 0.006,
          z: 0.005,
        },
        color: meta.color,
      });
    });

    // ── 7. Connecting Energy Beams & Data Flow Packets ────────────────
    const beamLines: THREE.Line[] = [];
    const beamPackets: DataPacket[] = [];

    agentNodes.forEach((node) => {
      // Curve connecting agent position to consensus core
      const midPoint = new THREE.Vector3().addVectors(node.basePosition, new THREE.Vector3(0, 0, 0)).multiplyScalar(0.5);
      midPoint.y += 2.5; // arc upward
      const curve = new THREE.QuadraticBezierCurve3(node.basePosition, midPoint, new THREE.Vector3(0, 0, 0));

      const points = curve.getPoints(32);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(node.color),
        transparent: true,
        opacity: 0.25,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      beamLines.push(line);

      // Glowing data packets traveling along the curve
      for (let p = 0; p < 2; p++) {
        const packetGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const packetMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(node.color),
          transparent: true,
          opacity: 0.85,
        });
        const packetMesh = new THREE.Mesh(packetGeo, packetMat);
        scene.add(packetMesh);
        beamPackets.push({
          mesh: packetMesh,
          curve,
          progress: (p * 0.5 + Math.random() * 0.2) % 1,
          speed: 0.008 + Math.random() * 0.004,
          color: new THREE.Color(node.color),
        });
      }
    });

    // ── 8. Raycasting & Mouse Interaction ────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - prevMousePos.x;
        const dy = e.clientY - prevMousePos.y;
        cameraTheta -= dx * 0.007;
        cameraPhi = Math.max(0.2, Math.min(Math.PI / 2.05, cameraPhi - dy * 0.007));
        prevMousePos = { x: e.clientX, y: e.clientY };
        updateCameraPosition();
      } else {
        // Raycasting for hover
        raycaster.setFromCamera(mouse, camera);
        const interactiveMeshes = agentNodes.map((n) => n.primaryMesh);
        const intersects = raycaster.intersectObjects(interactiveMeshes, false);

        if (intersects.length > 0 && intersects[0]?.object) {
          const hitObj = intersects[0].object;
          const hitAgentId = hitObj.userData.agentId as string;
          const meta = agents[hitAgentId];
          if (meta) {
            setHoveredAgent(meta);
            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            container.style.cursor = "pointer";
          }
        } else {
          setHoveredAgent(null);
          container.style.cursor = isDragging ? "grabbing" : "grab";
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDragging) {
        const dx = Math.abs(e.clientX - prevMousePos.x);
        const dy = Math.abs(e.clientY - prevMousePos.y);
        isDragging = false;
        container.style.cursor = "grab";
        // If it was just a click, test raycast for agent selection
        if (dx < 5 && dy < 5) {
          raycaster.setFromCamera(mouse, camera);
          const interactiveMeshes = agentNodes.map((n) => n.primaryMesh);
          const intersects = raycaster.intersectObjects(interactiveMeshes, false);
          if (intersects.length > 0 && intersects[0]?.object) {
            const hitAgentId = intersects[0].object.userData.agentId as string;
            onSelectAgent(hitAgentId);
          }
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraRadius = Math.max(14, Math.min(42, cameraRadius + e.deltaY * 0.025));
      updateCameraPosition();
    };

    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("wheel", handleWheel, { passive: false });

    // ── 9. Resize Handling ───────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || (isFullscreen ? window.innerWidth : 800);
      const h = container.clientHeight || (isFullscreen ? window.innerHeight : 540);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      handleResize();
    }) : null;
    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    // ── 10. Render Loop ──────────────────────────────────────────────
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Auto-rotation when not dragging
      if (autoRotate && !isDragging) {
        cameraTheta += 0.0022;
        updateCameraPosition();
      }

      // Pulse Consensus Core
      coreGroup.rotation.y = elapsedTime * 0.35;
      ring1.rotation.z = elapsedTime * 0.5;
      ring2.rotation.z = -elapsedTime * 0.45;
      const corePulse = 1 + Math.sin(elapsedTime * 3) * (isAuditing ? 0.08 : 0.03);
      coreGroup.scale.set(corePulse, corePulse, corePulse);
      coreLight.intensity = (isAuditing ? 6 : 3.5) + Math.sin(elapsedTime * 4) * 1.5;

      // Rotate Starfield gently
      starField.rotation.y = elapsedTime * 0.02;

      // Animate Agent Meshes
      agentNodes.forEach((node) => {
        const isSelected = node.agentId === activeAgentId;
        const isHovered = hoveredAgent?.id === node.agentId;

        // Individual shape rotation
        node.primaryMesh.rotation.x += node.rotationSpeed.x * (isAuditing ? 2.5 : 1);
        node.primaryMesh.rotation.y += node.rotationSpeed.y * (isAuditing ? 2.5 : 1);
        node.primaryMesh.rotation.z += node.rotationSpeed.z * (isAuditing ? 2.5 : 1);

        if (node.accentMesh) {
          node.accentMesh.rotation.x -= node.rotationSpeed.x * 1.2;
          node.accentMesh.rotation.y += node.rotationSpeed.y * 1.5;
        }
        if (node.wireframeMesh) {
          node.wireframeMesh.rotation.x += 0.005;
          node.wireframeMesh.rotation.y -= 0.008;
        }

        // Float bobbing effect
        node.group.position.y = node.basePosition.y + Math.sin(elapsedTime * 2 + node.orbitAngle) * 0.4;

        // Scale up on hover or when selected
        const targetScale = isSelected ? 1.35 : isHovered ? 1.2 : 1.0;
        node.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      });

      // Animate Data Packets and Beams
      const beamIntensity = activeBeams || isAuditing ? 0.65 : 0.2;
      beamLines.forEach((line) => {
        (line.material as THREE.LineBasicMaterial).opacity =
          beamIntensity + Math.sin(elapsedTime * 5) * 0.15;
      });

      beamPackets.forEach((packet) => {
        packet.progress += packet.speed * (isAuditing || activeBeams ? 2.2 : 1.0);
        if (packet.progress > 1) packet.progress = 0;

        const pos = packet.curve.getPoint(packet.progress);
        packet.mesh.position.copy(pos);
        // Pulse size along path
        const pScale = Math.sin(packet.progress * Math.PI) * (isAuditing ? 1.5 : 1.0);
        packet.mesh.scale.set(pScale, pScale, pScale);
      });

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ──────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("wheel", handleWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [activeAgentId, autoRotate, activeBeams, isAuditing, onSelectAgent, agents, isFullscreen]);

  return (
    <div className={`swarm-canvas-wrapper ${isFullscreen ? "is-fullscreen" : ""}`}>
      {/* Three.js canvas container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />

      {/* Floating interactive tooltip on 3D hover */}
      {hoveredAgent && (
        <div
          className="swarm-3d-tooltip"
          style={{
            left: Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth || 800) - 220),
            top: Math.max(tooltipPos.y - 45, 15),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="pulse-dot"
              style={{ backgroundColor: hoveredAgent.color }}
            />
            <span style={{ fontWeight: 700, color: "#fff" }}>{hoveredAgent.name}</span>
          </div>
          <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: 11 }}>{hoveredAgent.shapeLabel}</p>
          <p style={{ margin: "4px 0 0 0", color: "#38bdf8", fontFamily: "var(--font-mono)", fontSize: 10 }}>
            Click in 3D to inspect agent details →
          </p>
        </div>
      )}

      {/* Top HUD overlay */}
      <div className="swarm-hud-header">
        <div className="swarm-hud-badge">
          <span
            className="pulse-dot"
            style={{
              backgroundColor: isAuditing ? "#f59e0b" : "#10b981",
              boxShadow: isAuditing ? "0 0 10px #f59e0b" : "0 0 10px #10b981",
            }}
          />
          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
            {isAuditing ? `Swarm Active: ${auditPhase.toUpperCase()}` : "Swarm Core: Ready & Listening"}
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              background: "#132038",
              color: "#2dd4bf",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid rgba(45, 212, 191, 0.25)",
            }}
          >
            Hedera HCS 0.0.10417469
          </span>

          {isFullscreen && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                background: "rgba(0, 245, 255, 0.15)",
                color: "#00f5ff",
                padding: "2px 8px",
                borderRadius: 6,
                border: "1px solid rgba(0, 245, 255, 0.35)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>⛶</span> FULLSCREEN THEATER
            </span>
          )}
        </div>

        {/* Viewport Control Buttons */}
        <div className="swarm-hud-actions">
          <button
            type="button"
            onClick={() => setActiveBeams((prev) => !prev)}
            className={`swarm-hud-btn ${activeBeams ? "active" : ""}`}
          >
            ⚡ {activeBeams ? "Beams Active" : "Trigger Beams"}
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`swarm-hud-btn ${autoRotate ? "active" : ""}`}
          >
            🔄 {autoRotate ? "Auto-Rotate" : "Paused"}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`swarm-hud-btn ${isFullscreen ? "active" : ""}`}
            style={isFullscreen ? { background: "rgba(239, 68, 68, 0.2)", borderColor: "rgba(239, 68, 68, 0.5)", color: "#fca5a5" } : undefined}
            title={isFullscreen ? "Exit Fullscreen Mode (Esc or F)" : "Enter Fullscreen Mode (F)"}
          >
            {isFullscreen ? "✕ Exit Fullscreen" : "⛶ Fullscreen"}
          </button>
        </div>
      </div>

      {/* Bottom Agent Selector Bar */}
      <div className="swarm-bottom-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, paddingRight: 6 }}>
            Active Swarm:
          </span>
          {Object.values(agents).map((agent) => {
            const isSelected = activeAgentId === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className={`swarm-agent-pill ${isSelected ? "selected" : ""}`}
                style={{
                  borderColor: isSelected ? agent.color : "transparent",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: agent.color,
                    boxShadow: `0 0 8px ${agent.color}`,
                    marginRight: 6,
                  }}
                />
                <span>{agent.shortName}</span>
                <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4 }}>
                  ({agent.shapeLabel.split(" ")[0]})
                </span>
                {agent.isCustom && (
                  <span
                    style={{
                      fontSize: 9,
                      backgroundColor: `${agent.color}25`,
                      color: agent.color,
                      padding: "1px 4px",
                      borderRadius: 4,
                      marginLeft: 4,
                      fontWeight: 700,
                    }}
                  >
                    CUSTOM
                  </span>
                )}
              </button>
            );
          })}

          {onOpenRegisterModal && (
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="swarm-agent-pill"
              style={{
                borderColor: "#3b82f6",
                color: "#60a5fa",
                background: "rgba(59, 130, 246, 0.15)",
                fontWeight: 600,
              }}
            >
              <span style={{ marginRight: 4 }}>➕</span> Register Agent
            </button>
          )}
        </div>

        <div style={{ fontSize: 11, color: "#64748b", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
          Drag to orbit • Scroll to zoom
        </div>
      </div>
    </div>
  );
}
