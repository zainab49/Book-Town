"use client";

import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Group, Vector3 } from "three";
import { BottomNav } from "@/components/bottom-nav";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const GRID_N = 10;
const TILE_SIZE = 2;

type TownAsset = {
  id: number;
  user_id: number;
  book_id: number | null;
  model_filename: string;
  pos_x: number;
  pos_z: number;
  rotation_y: number;
  placed_at: string;
  book_title: string;
  book_author: string;
};

type StoredItem = {
  id: number;
  user_id: number;
  model_filename: string;
  book_id: number | null;
  stored_at: string;
};

type BuildingConfig = {
  name: string;
  filename: string;
  cost: number;
  requiredBooks: number;
  category: string;
};

const BUILDINGS: BuildingConfig[] = [
  // Houses
  { name: "Town House",    filename: "house_001.glb",             cost: 50,  requiredBooks: 0, category: "Houses" },
  { name: "Cottage",       filename: "house_002.glb",             cost: 80,  requiredBooks: 1, category: "Houses" },
  { name: "Grand House",   filename: "house_003.glb",             cost: 120, requiredBooks: 3, category: "Houses" },
  // Market
  { name: "Market Stall",  filename: "stall_001.glb",             cost: 80,  requiredBooks: 1, category: "Market" },
  { name: "Stall Table",   filename: "stall_table_001.glb",       cost: 55,  requiredBooks: 1, category: "Market" },
  { name: "Cart",          filename: "cart_001.glb",              cost: 60,  requiredBooks: 1, category: "Market" },
  { name: "Table",         filename: "table_001.glb",             cost: 40,  requiredBooks: 0, category: "Market" },
  // Nature
  { name: "Fir Tree",      filename: "fir_001.glb",               cost: 55,  requiredBooks: 0, category: "Nature" },
  { name: "Tree",          filename: "tree_001.glb",              cost: 45,  requiredBooks: 0, category: "Nature" },
  { name: "Fabulous Tree", filename: "fabulous_tree_001.glb",     cost: 65,  requiredBooks: 0, category: "Nature" },
  { name: "Big Tree",      filename: "big_fabulous_tree_001.glb", cost: 75,  requiredBooks: 0, category: "Nature" },
  { name: "Cactus",        filename: "cactus_001.glb",            cost: 35,  requiredBooks: 0, category: "Nature" },
  // Mushrooms
  { name: "Mushroom",      filename: "fabulous_mushroom_001.glb", cost: 35,  requiredBooks: 0, category: "Mushrooms" },
  { name: "Blue Mushroom", filename: "fabulous_mushroom_002.glb", cost: 35,  requiredBooks: 0, category: "Mushrooms" },
  { name: "Red Mushroom",  filename: "fabulous_mushroom_003.glb", cost: 35,  requiredBooks: 0, category: "Mushrooms" },
  { name: "Prpl Mushroom", filename: "fabulous_mushroom_004.glb", cost: 35,  requiredBooks: 0, category: "Mushrooms" },
  // Structures
  { name: "Crane",         filename: "crane_001.glb",             cost: 100, requiredBooks: 2, category: "Structures" },
  { name: "Sign Post",     filename: "pointer_001.glb",           cost: 25,  requiredBooks: 0, category: "Structures" },
  { name: "Holder",        filename: "holder_001.glb",            cost: 20,  requiredBooks: 0, category: "Structures" },
  // Containers
  { name: "Barrel",        filename: "barrel_001.glb",            cost: 30,  requiredBooks: 0, category: "Containers" },
  { name: "Box",           filename: "box_001.glb",               cost: 20,  requiredBooks: 0, category: "Containers" },
  { name: "Crate",         filename: "box_001_001.glb",           cost: 20,  requiredBooks: 0, category: "Containers" },
  { name: "Wooden Box",    filename: "box_002.glb",               cost: 20,  requiredBooks: 0, category: "Containers" },
  { name: "Small Box",     filename: "box_003.glb",               cost: 15,  requiredBooks: 0, category: "Containers" },
  { name: "Bucket",        filename: "bucket_001.glb",            cost: 15,  requiredBooks: 0, category: "Containers" },
  // Logs
  { name: "Log",           filename: "log_001.glb",               cost: 15,  requiredBooks: 0, category: "Logs" },
  { name: "Short Log",     filename: "log_002.glb",               cost: 15,  requiredBooks: 0, category: "Logs" },
  { name: "Log Stack",     filename: "log_003.glb",               cost: 20,  requiredBooks: 0, category: "Logs" },
  { name: "Tree Stump",    filename: "log_004.glb",               cost: 15,  requiredBooks: 0, category: "Logs" },
  // Jugs
  { name: "Jug",           filename: "jug_001.glb",               cost: 15,  requiredBooks: 0, category: "Jugs" },
  { name: "Clay Jug",      filename: "jug_002.glb",               cost: 15,  requiredBooks: 0, category: "Jugs" },
  { name: "Stone Jug",     filename: "jug_003.glb",               cost: 15,  requiredBooks: 0, category: "Jugs" },
  { name: "Tall Jug",      filename: "jug_004.glb",               cost: 15,  requiredBooks: 0, category: "Jugs" },
  { name: "Small Jug",     filename: "jug_005.glb",               cost: 10,  requiredBooks: 0, category: "Jugs" },
  // Plates
  { name: "Plate",         filename: "plate_001.glb",             cost: 10,  requiredBooks: 0, category: "Plates" },
  { name: "Platter",       filename: "plate_002.glb",             cost: 12,  requiredBooks: 0, category: "Plates" },
  { name: "Small Plate",   filename: "plate_003.glb",             cost: 10,  requiredBooks: 0, category: "Plates" },
  // Bags
  { name: "Bag",           filename: "bag_001.glb",               cost: 20,  requiredBooks: 0, category: "Bags" },
  { name: "Satchel",       filename: "bag_002.glb",               cost: 25,  requiredBooks: 0, category: "Bags" },
  { name: "Travel Bag",    filename: "bag_003.glb",               cost: 30,  requiredBooks: 0, category: "Bags" },
  { name: "Large Bag",     filename: "bag_004.glb",               cost: 35,  requiredBooks: 0, category: "Bags" },
];

const CATEGORIES = ["Houses", "Market", "Nature", "Mushrooms", "Structures", "Containers", "Logs", "Jugs", "Plates", "Bags"] as const;

// GLBs are loaded on-demand by useGLTF when a model first renders.

function getToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("booktown_token") ?? "";
}

// Placed building

function PlacedBuilding({
  asset,
  selected,
  tooltipActive,
  editMode,
  onSelect,
}: {
  asset: TownAsset;
  selected: boolean;
  tooltipActive: boolean;
  editMode: boolean;
  onSelect: () => void;
}) {
  const { scene } = useGLTF(`/assets/3d/${asset.model_filename}`);
  const model = useMemo(() => scene.clone(true), [scene]);
  const groupRef = useRef<Group>(null);

  // Pulse ring when selected
  useFrame(({ clock }) => {
    if (groupRef.current && selected) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.04;
      groupRef.current.scale.setScalar(s);
    } else if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[asset.pos_x, 0, asset.pos_z]}
      rotation={[0, asset.rotation_y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <primitive object={model} scale={1} />
      {/* Selection ring */}
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.7, 0.9, 32]} />
          <meshStandardMaterial color="#853953" transparent opacity={0.9} />
        </mesh>
      ) : null}
      {/* Tooltip */}
      {tooltipActive && !editMode ? (
        <Html distanceFactor={11} center>
          <div className="rounded-[var(--r-sm)] border border-[var(--border-brand)] bg-[var(--surface)] px-2 py-1.5 text-[11px] text-[var(--ink)] shadow-[var(--sh-md)]">
            <p className="font-semibold">{asset.book_title || "Town object"}</p>
            {asset.book_author ? (
              <p className="text-[10px] text-[var(--muted)]">{asset.book_author}</p>
            ) : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

// Grid tile

function GridTile({
  x,
  z,
  occupied,
  active,
  hovered,
  onPlace,
  onHover,
}: {
  x: number;
  z: number;
  occupied: boolean;
  active: boolean; // placement or move mode is on
  hovered: boolean;
  onPlace: (x: number, z: number) => void;
  onHover: (x: number | null, z: number | null) => void;
}) {
  let color = "#a07d90";
  let opacity = 0.16;

  if (active) {
    if (hovered) {
      color = occupied ? "#c0392b" : "#27ae60";
      opacity = 0.7;
    } else if (occupied) {
      color = "#612d53";
      opacity = 0.42;
    } else {
      color = "#853953";
      opacity = 0.22;
    }
  }

  return (
    <mesh
      position={[x, 0, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={
        active && !occupied
          ? (e) => {
              e.stopPropagation();
              onPlace(x, z);
            }
          : undefined
      }
      onPointerOver={
        active
          ? (e) => {
              e.stopPropagation();
              onHover(x, z);
            }
          : undefined
      }
      onPointerOut={
        active
          ? () => onHover(null, null)
          : undefined
      }
    >
      <planeGeometry args={[TILE_SIZE - 0.12, TILE_SIZE - 0.12]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

// Town grid

function TownGrid({
  assets,
  active,
  movingAssetId,
  onPlace,
  hoveredTile,
  onHover,
}: {
  assets: TownAsset[];
  active: boolean;
  movingAssetId: number | null;
  onPlace: (x: number, z: number) => void;
  hoveredTile: { x: number; z: number } | null;
  onHover: (x: number | null, z: number | null) => void;
}) {
  const occupied = useMemo(() => {
    const map = new Set<string>();
    assets.forEach((a) => {
      if (a.id !== movingAssetId) map.add(`${a.pos_x},${a.pos_z}`);
    });
    return map;
  }, [assets, movingAssetId]);

  const tiles: JSX.Element[] = [];
  for (let i = 0; i < GRID_N; i += 1) {
    for (let j = 0; j < GRID_N; j += 1) {
      const x = i * TILE_SIZE - (GRID_N - 1);
      const z = j * TILE_SIZE - (GRID_N - 1);
      const isOccupied = occupied.has(`${x},${z}`);
      const isHovered = hoveredTile?.x === x && hoveredTile?.z === z;
      tiles.push(
        <GridTile
          key={`${i}-${j}`}
          x={x}
          z={z}
          occupied={isOccupied}
          active={active}
          hovered={isHovered}
          onPlace={onPlace}
          onHover={onHover}
        />,
      );
    }
  }

  return <group>{tiles}</group>;
}

// OrbitControls wrapper that disables when in edit mode

function SceneControls({ disabled }: { disabled: boolean }) {
  const controls = useRef<any>(null);
  useEffect(() => {
    if (controls.current) {
      controls.current.enabled = !disabled;
    }
  }, [disabled]);
  return (
    <OrbitControls
      ref={controls}
      target={[0, 0, 0]}
      maxPolarAngle={Math.PI / 2.05}
      enableDamping
    />
  );
}

// Town scene

function TownScene({
  assets,
  selectedAssetId,
  tooltipId,
  placementMode,
  movingAssetId,
  onTileClick,
  onAssetSelect,
  hoveredTile,
  onHover,
}: {
  assets: TownAsset[];
  selectedAssetId: number | null;
  tooltipId: number | null;
  placementMode: boolean;
  movingAssetId: number | null;
  onTileClick: (x: number, z: number) => void;
  onAssetSelect: (id: number) => void;
  hoveredTile: { x: number; z: number } | null;
  onHover: (x: number | null, z: number | null) => void;
}) {
  const isActive = placementMode || movingAssetId !== null;
  return (
    <Canvas camera={{ position: [10, 16, 18], fov: 46 }} style={{ background: "#F3F4F4" }}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[10, 14, 8]} intensity={0.8} />
      <SceneControls disabled={isActive} />
      <TownGrid
        assets={assets}
        active={isActive}
        movingAssetId={movingAssetId}
        onPlace={onTileClick}
        hoveredTile={hoveredTile}
        onHover={onHover}
      />
      <Suspense fallback={null}>
        {assets.map((asset) => (
          <PlacedBuilding
            key={asset.id}
            asset={asset}
            selected={selectedAssetId === asset.id}
            tooltipActive={tooltipId === asset.id}
            editMode={isActive}
            onSelect={() => onAssetSelect(asset.id)}
          />
        ))}
      </Suspense>
    </Canvas>
  );
}

// Shop 3D preview

function ShopItemView3D({ filename }: { filename: string }) {
  const { scene } = useGLTF(`/assets/3d/${filename}`);
  const groupRef = useRef<Group>(null);

  const { cloned, scale } = useMemo(() => {
    const c = scene.clone(true);
    const box = new Box3().setFromObject(c);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    c.position.set(-center.x, -box.min.y, -center.z);
    return { cloned: c, scale: 1.2 / maxDim };
  }, [scene]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.65;
  });

  return (
    <>
      <ambientLight intensity={1.6} />
      <directionalLight position={[4, 6, 4]} intensity={0.8} />
      <group ref={groupRef} scale={scale}>
        <primitive object={cloned} />
      </group>
    </>
  );
}

function ShopItemCard({
  building,
  points,
  finishedBooks,
  isSelected,
  onSelect,
  onHover,
}: {
  building: BuildingConfig;
  points: number;
  finishedBooks: number;
  isSelected: boolean;
  onSelect: (b: BuildingConfig) => void;
  onHover: (filename: string | null) => void;
}) {
  const canAfford = points >= building.cost;
  const meetsBooks = finishedBooks >= building.requiredBooks;
  const canSelect = canAfford && meetsBooks;

  return (
    <button
      type="button"
      onClick={() => { if (canSelect) onSelect(building); }}
      onMouseEnter={() => onHover(building.filename)}
      onMouseLeave={() => onHover(null)}
      onTouchStart={() => onHover(building.filename)}
      className="rounded-[var(--r-xs)] border px-2 py-2 text-left transition-all"
      style={{
        borderColor: isSelected ? "#853953" : "#ddd",
        background: isSelected ? "#853953" : "#F3F4F4",
        opacity: canSelect ? 1 : 0.35,
        cursor: canSelect ? "pointer" : "not-allowed",
        boxShadow: isSelected ? "0 0 0 2px #612D53" : undefined,
      }}
    >
      <p className="truncate text-[11px] font-semibold leading-[1.3]" style={{ color: isSelected ? "#fff" : "#2C2C2C" }}>
        {building.name}
      </p>
      <p className="mt-0.5 text-[11px] font-bold" style={{ color: isSelected ? "rgba(255,255,255,0.85)" : "#853953" }}>
        {building.cost}p
      </p>
    </button>
  );
}

// Page

export default function TownPage() {
  useBackgroundMusic("/assets/music/5-circus_acrobat.wav");

  const [mounted, setMounted] = useState(false);
  const [assets, setAssets] = useState<TownAsset[]>([]);
  const [username, setUsername] = useState("");
  const [points, setPoints] = useState(0);
  const [finishedBooks, setFinishedBooks] = useState(0);

  // Placement of new building
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingConfig | null>(null);
  const [placing, setPlacing] = useState(false);

  // Editing a placed asset
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [movingAssetId, setMovingAssetId] = useState<number | null>(null);
  const [pendingRotation, setPendingRotation] = useState(0);

  // Hover feedback
  const [hoveredTile, setHoveredTile] = useState<{ x: number; z: number } | null>(null);

  // Tooltips (view mode)
  const [tooltipId, setTooltipId] = useState<number | null>(null);

  // Visit mode
  const [visitInput, setVisitInput] = useState("");
  const [visitMode, setVisitMode] = useState(false);
  const [visitUsername, setVisitUsername] = useState("");

  // Storage (items removed from town)
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [selectedStoredItem, setSelectedStoredItem] = useState<StoredItem | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"shop" | "storage">("shop");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hoveredShopItem, setHoveredShopItem] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Houses");
  const shopPreviewFilename = hoveredShopItem ?? selectedBuilding?.filename ?? selectedStoredItem?.model_filename ?? null;

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const visitParam = params.get("visit")?.trim();
    if (visitParam) {
      void fetchTownByUsername(visitParam);
      setVisitInput(visitParam);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("visit")?.trim()) return; // visiting another user — don't overwrite their assets
    void loadOwnTown();
    void loadStats();
    void loadStorage();
  }, []);

  // Keyboard handler: R = rotate 90°, Escape = cancel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cancelAll();
        return;
      }
      if ((e.key === "r" || e.key === "R") && selectedAssetId !== null) {
        setPendingRotation((r) => r + Math.PI / 2);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedAssetId]);

  // Sync pending rotation into the assets list for live preview
  const displayAssets = useMemo(() => {
    if (selectedAssetId === null) return assets;
    return assets.map((a) =>
      a.id === selectedAssetId ? { ...a, rotation_y: pendingRotation } : a,
    );
  }, [assets, selectedAssetId, pendingRotation]);

  function cancelAll() {
    setSelectedBuilding(null);
    setSelectedAssetId(null);
    setMovingAssetId(null);
    setSelectedStoredItem(null);
    setHoveredTile(null);
  }

  async function loadOwnTown() {
    const res = await fetch(`${API_BASE}/api/town`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { setError("Failed to load town."); return; }
    const payload = (await res.json()) as { assets?: TownAsset[]; username?: string };
    setAssets(payload.assets ?? []);
    setUsername(payload.username ?? "");
  }

  async function loadStats() {
    const res = await fetch(`${API_BASE}/api/users/me/stats`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const payload = (await res.json()) as { points?: number; finished?: number };
    setPoints(payload.points ?? 0);
    setFinishedBooks(payload.finished ?? 0);
  }

  async function loadStorage() {
    const res = await fetch(`${API_BASE}/api/storage`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const payload = (await res.json()) as { items?: StoredItem[] };
    setStoredItems(payload.items ?? []);
  }

  async function placeFromStorage(storageId: number, x: number, z: number) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/storage/${storageId}/place`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pos_x: x, pos_z: z }),
      });
      const payload = (await res.json()) as { asset?: TownAsset; error?: string };
      if (!res.ok || !payload.asset) { setError(payload.error ?? "Could not place item."); return; }
      setAssets((prev) => [...prev, payload.asset!]);
      setStoredItems((prev) => prev.filter((i) => i.id !== storageId));
      setSelectedStoredItem(null);
      setHoveredTile(null);
    } catch {
      setError("Network error while placing item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFromStorage(storageId: number) {
    const res = await fetch(`${API_BASE}/api/storage/${storageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      setStoredItems((prev) => prev.filter((i) => i.id !== storageId));
    }
  }

  async function fetchTownByUsername(name: string) {
    setError(null);
    const res = await fetch(`${API_BASE}/api/town/${encodeURIComponent(name)}`);
    const payload = (await res.json()) as { assets?: TownAsset[]; username?: string; error?: string };
    if (!res.ok) { setError(payload.error ?? "User town not found."); return; }
    setAssets(payload.assets ?? []);
    setVisitMode(true);
    setVisitUsername(payload.username ?? name);
    cancelAll();
  }

  // Click on a tile - either placing new building, placing from storage, or moving existing one
  async function handleTileClick(x: number, z: number) {
    if (visitMode || saving) return;

    if (movingAssetId !== null) {
      await commitMove(movingAssetId, x, z);
      return;
    }

    if (selectedStoredItem) {
      await placeFromStorage(selectedStoredItem.id, x, z);
      return;
    }

    if (selectedBuilding) {
      await placeBuildingAt(x, z);
    }
  }

  async function placeBuildingAt(x: number, z: number) {
    if (!selectedBuilding || placing) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/town/place`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model_filename: selectedBuilding.filename, pos_x: x, pos_z: z, book_id: null }),
      });
      const payload = (await res.json()) as { asset?: TownAsset; new_points_balance?: number; error?: string };
      if (!res.ok || !payload.asset) { setError(payload.error ?? "Could not place building."); return; }
      setAssets((prev) => [...prev, payload.asset!]);
      setPoints(payload.new_points_balance ?? points);
      setSelectedBuilding(null);
    } catch {
      setError("Network error while placing building.");
    } finally {
      setPlacing(false);
    }
  }

  async function commitMove(assetId: number, x: number, z: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/town/assets/${assetId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pos_x: x, pos_z: z, rotation_y: pendingRotation }),
      });
      const payload = (await res.json()) as { asset?: TownAsset; error?: string };
      if (!res.ok || !payload.asset) { setError(payload.error ?? "Could not move building."); return; }
      setAssets((prev) => prev.map((a) => (a.id === assetId ? payload.asset! : a)));
      setMovingAssetId(null);
      setSelectedAssetId(null);
      setHoveredTile(null);
    } catch {
      setError("Network error while moving building.");
    } finally {
      setSaving(false);
    }
  }

  async function commitRotateOnly(assetId: number) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/town/assets/${assetId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pos_x: asset.pos_x, pos_z: asset.pos_z, rotation_y: pendingRotation }),
      });
      const payload = (await res.json()) as { asset?: TownAsset };
      if (res.ok && payload.asset) {
        setAssets((prev) => prev.map((a) => (a.id === assetId ? payload.asset! : a)));
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset(assetId: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/town/assets/${assetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = (await res.json()) as { ok?: boolean; stored_item?: StoredItem; error?: string };
      if (!res.ok) { setError(payload.error ?? "Could not remove building."); return; }
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      if (payload.stored_item) {
        setStoredItems((prev) => [payload.stored_item!, ...prev]);
        setSidebarTab("storage");
      }
      cancelAll();
    } finally {
      setSaving(false);
    }
  }

  function handleAssetSelect(id: number) {
    if (visitMode || selectedBuilding) return;
    if (selectedAssetId === id) {
      // Second click = deselect
      cancelAll();
      return;
    }
    const asset = assets.find((a) => a.id === id);
    setSelectedAssetId(id);
    setMovingAssetId(null);
    setPendingRotation(asset?.rotation_y ?? 0);
    setTooltipId(null);
  }

  function startMove() {
    if (selectedAssetId === null) return;
    setMovingAssetId(selectedAssetId);
  }

  function cancelMove() {
    setMovingAssetId(null);
    setHoveredTile(null);
    // Restore rotation from saved state
    const asset = assets.find((a) => a.id === selectedAssetId);
    setPendingRotation(asset?.rotation_y ?? 0);
  }

  function clearVisitMode() {
    setVisitMode(false);
    setVisitUsername("");
    setVisitInput("");
    setError(null);
    void loadOwnTown();
  }

  const selectedAsset = selectedAssetId !== null ? assets.find((a) => a.id === selectedAssetId) ?? null : null;
  const isEditActive = selectedBuilding !== null || movingAssetId !== null || selectedStoredItem !== null;

  if (!mounted) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-[var(--muted)]">Loading town...</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:pl-60">
      <header className="page-header-bar">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/dashboard" className="back-btn" aria-label="Back to dashboard">
            &#8592;
          </Link>
          <div className="min-w-0">
            <p className="page-title">Town Editor</p>
            <p className="truncate text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              {visitMode ? `Viewing @${visitUsername}` : `@${username || "reader"}`}
            </p>
          </div>
        </div>
        <div className="points-pill">
          {visitMode ? "Visit mode" : `${points} pts`}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-20 md:px-8 md:py-6 md:pb-24">
        <section className="mx-auto max-w-7xl space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">

            {/* 3D canvas */}
            <section className="town-panel relative overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 md:px-5">
                {visitMode ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-[var(--border-brand)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary-deep)]">
                      Visit Mode
                    </span>
                    <span className="text-xs text-[var(--ink-muted)]">@{visitUsername}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[var(--primary-deep)]">{points}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">pts</span>
                    </div>
                    <div className="h-4 w-px bg-[var(--border)]" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[var(--primary-deep)]">{finishedBooks}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">books</span>
                    </div>
                  </div>
                )}
                {visitMode ? (
                  <button className="btn-primary px-3 py-1.5 text-xs" onClick={clearVisitMode}>
                    Back to My Town
                  </button>
                ) : null}
              </div>

              {/* Mode hints */}
              {selectedBuilding && !visitMode ? (
                <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-[var(--r-sm)] bg-[var(--primary-deep)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--sh-md)]">
                  {placing ? "Placing..." : "Tap a green tile to place · Esc to cancel"}
                </div>
              ) : null}
              {movingAssetId !== null ? (
                <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-[var(--r-sm)] bg-[#27ae60] px-4 py-2 text-xs font-semibold text-white shadow-[var(--sh-md)]">
                  {saving ? "Moving..." : "Tap a green tile to move here · Esc to cancel"}
                </div>
              ) : null}
              {selectedStoredItem !== null && movingAssetId === null ? (
                <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-[var(--r-sm)] bg-[#853953] px-4 py-2 text-xs font-semibold text-white shadow-[var(--sh-md)]">
                  {saving ? "Placing..." : "Tap a green tile to place stored item · Esc to cancel"}
                </div>
              ) : null}

              <div className="h-[58vh] min-h-[360px] md:h-[68vh]">
                <TownScene
                  assets={displayAssets}
                  selectedAssetId={selectedAssetId}
                  tooltipId={tooltipId}
                  placementMode={selectedBuilding !== null || selectedStoredItem !== null}
                  movingAssetId={movingAssetId}
                  onTileClick={handleTileClick}
                  onAssetSelect={visitMode ? (id) => setTooltipId((cur) => (cur === id ? null : id)) : handleAssetSelect}
                  hoveredTile={isEditActive ? hoveredTile : null}
                  onHover={(x, z) => {
                    if (x === null || z === null) setHoveredTile(null);
                    else setHoveredTile({ x, z });
                  }}
                />
              </div>

              {/* Selected asset controls (shown below canvas) */}
              {selectedAsset && !visitMode ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3">
                  <span className="flex-1 text-xs font-semibold text-[var(--primary-deep)]">
                    {selectedAsset.book_title || selectedAsset.model_filename.replace(".glb", "")}
                  </span>
                  {movingAssetId === null ? (
                    <>
                      <button
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={startMove}
                      >
                        Move
                      </button>
                      <button
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => {
                          setPendingRotation((r) => r + Math.PI / 2);
                          void commitRotateOnly(selectedAssetId!);
                        }}
                        disabled={saving}
                      >
                        Rotate
                      </button>
                      <button
                        className="rounded-[var(--r-sm)] border border-[#c0392b] bg-[#fceced] px-3 py-1.5 text-xs font-semibold text-[#c0392b]"
                        onClick={() => void deleteAsset(selectedAssetId!)}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={cancelMove}>
                      Cancel Move
                    </button>
                  )}
                </div>
              ) : null}
            </section>

            {/* Sidebar */}
            <aside className="town-panel flex flex-col overflow-hidden p-0">
              {/* Sidebar tabs */}
              {!visitMode ? (
                <div className="flex border-b" style={{ borderColor: "#ddd", background: "#F3F4F4" }}>
                  {(["shop", "storage"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setSidebarTab(tab); if (tab === "shop") setSelectedStoredItem(null); }}
                      className="flex-1 py-2.5 text-[11px] font-semibold capitalize transition-all"
                      style={{
                        color: sidebarTab === tab ? "#612D53" : "#999",
                        borderBottom: sidebarTab === tab ? "2px solid #853953" : "2px solid transparent",
                        background: "transparent",
                      }}
                    >
                      {tab === "storage" && storedItems.length > 0 ? `Storage (${storedItems.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="border-b px-4 py-3" style={{ background: "#F3F4F4", borderColor: "#ddd" }}>
                  <p className="section-label px-0" style={{ color: "#612D53" }}>Visit Mode</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3">
              {!visitMode ? (
                <>
                  {/* Single shared Canvas for all previews: browsers cap WebGL
                      contexts at ~16 per page, so one card-per-Canvas would hit
                      the limit immediately with a full shop list. */}
                  <div className="mb-2 overflow-hidden rounded-[var(--r-sm)]" style={{ aspectRatio: "1/1", background: "#F3F4F4" }}>
                    {shopPreviewFilename ? (
                      <Canvas
                        camera={{ position: [2.2, 2, 2.2], fov: 34 }}
                        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
                        style={{ width: "100%", height: "100%" }}
                      >
                        <Suspense fallback={null}>
                          <ShopItemView3D filename={shopPreviewFilename} />
                        </Suspense>
                      </Canvas>
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px]" style={{ color: "#853953" }}>
                        Tap an item to preview
                      </div>
                    )}
                  </div>

                  {sidebarTab === "shop" ? (
                    <>
                      {selectedBuilding ? (
                        <div className="mb-2 rounded-[var(--r-sm)] border p-2" style={{ borderColor: "#853953", background: "rgba(133,57,83,0.06)" }}>
                          <p className="text-[11px] font-bold" style={{ color: "#612D53" }}>
                            Placing: {selectedBuilding.name}
                          </p>
                          <button className="btn-secondary mt-1.5 w-full text-xs" onClick={() => setSelectedBuilding(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : null}

                      {/* Category tabs */}
                      <div className="mb-3 flex flex-wrap gap-1">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all"
                            style={{
                              background: selectedCategory === cat ? "#612D53" : "#F3F4F4",
                              color: selectedCategory === cat ? "#fff" : "#612D53",
                              border: `1px solid ${selectedCategory === cat ? "#612D53" : "#ccc"}`,
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Items for selected category */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {BUILDINGS.filter((b) => b.category === selectedCategory).map((b) => (
                          <ShopItemCard
                            key={b.filename}
                            building={b}
                            points={points}
                            finishedBooks={finishedBooks}
                            isSelected={selectedBuilding?.filename === b.filename}
                            onSelect={(b) => { cancelAll(); setSelectedBuilding(b); }}
                            onHover={setHoveredShopItem}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Storage tab */
                    <>
                      {selectedStoredItem ? (
                        <div className="mb-2 rounded-[var(--r-sm)] border p-2" style={{ borderColor: "#853953", background: "rgba(133,57,83,0.06)" }}>
                          <p className="text-[11px] font-bold" style={{ color: "#612D53" }}>
                            Placing: {BUILDINGS.find((b) => b.filename === selectedStoredItem.model_filename)?.name ?? selectedStoredItem.model_filename.replace(".glb", "")}
                          </p>
                          <button className="btn-secondary mt-1.5 w-full text-xs" onClick={() => setSelectedStoredItem(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : null}

                      {storedItems.length === 0 ? (
                        <p className="mt-2 text-center text-[11px] text-[var(--ink-muted)]">
                          No items in storage. Remove items from your town to save them here.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {Object.values(
                            storedItems.reduce<Record<string, StoredItem[]>>((acc, item) => {
                              (acc[item.model_filename] ??= []).push(item);
                              return acc;
                            }, {})
                          ).map((group) => {
                            const item = group[0];
                            const def = BUILDINGS.find((b) => b.filename === item.model_filename);
                            const name = def?.name ?? item.model_filename.replace(".glb", "");
                            const count = group.length;
                            const isSelected = selectedStoredItem?.model_filename === item.model_filename;
                            return (
                              <div
                                key={item.model_filename}
                                className="flex items-center gap-2 rounded-[var(--r-xs)] border px-2 py-2"
                                style={{
                                  borderColor: isSelected ? "#853953" : "#ddd",
                                  background: isSelected ? "rgba(133,57,83,0.06)" : "#F3F4F4",
                                }}
                                onMouseEnter={() => setHoveredShopItem(item.model_filename)}
                                onMouseLeave={() => setHoveredShopItem(null)}
                                onTouchStart={() => setHoveredShopItem(item.model_filename)}
                              >
                                <p className="flex-1 truncate text-[11px] font-semibold" style={{ color: "#2C2C2C" }}>
                                  {name}
                                </p>
                                {count > 1 && (
                                  <span
                                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                                    style={{ background: "#853953", color: "#fff", minWidth: "1.4rem", textAlign: "center" }}
                                  >
                                    {count}
                                  </span>
                                )}
                                <button
                                  className="rounded-[var(--r-xs)] px-2 py-1 text-[10px] font-semibold text-white"
                                  style={{ background: "#853953" }}
                                  onClick={() => { cancelAll(); setSelectedStoredItem(item); setSidebarTab("storage"); }}
                                >
                                  Place
                                </button>
                                <button
                                  className="rounded-[var(--r-xs)] border border-[#ccc] px-2 py-1 text-[10px] font-semibold text-[#999]"
                                  style={{ background: "#fff" }}
                                  onClick={() => void deleteFromStorage(item.id)}
                                  title="Permanently delete one"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs text-[var(--ink-muted)]">
                  Shop disabled while visiting.
                </p>
              )}

              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <p className="section-label px-0">Visit a Friend</p>
                <div className="mt-2">
                  <label className="field-label">Username</label>
                  <input
                    value={visitInput}
                    onChange={(e) => setVisitInput(e.target.value)}
                    placeholder="username"
                    className="field"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && visitInput.trim()) void fetchTownByUsername(visitInput.trim());
                    }}
                  />
                </div>
                <button
                  className="btn-primary mt-2 w-full"
                  onClick={() => void fetchTownByUsername(visitInput.trim())}
                  disabled={!visitInput.trim()}
                >
                  Visit Town
                </button>
              </div>
              </div>
            </aside>
          </div>

          {error ? (
            <p className="rounded-[var(--r-sm)] bg-[#fceced] px-3 py-2.5 text-sm text-[#a3213a]">
              {error}
            </p>
          ) : null}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

