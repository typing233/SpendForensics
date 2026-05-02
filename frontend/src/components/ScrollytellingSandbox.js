import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useThree, useFrame, Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

const BUDGET_CATEGORIES = [
  { name: '餐饮', color: '#f97316', budget: 5000, actual: 4200 },
  { name: '娱乐', color: '#ec4899', budget: 2000, actual: 1800 },
  { name: '购物', color: '#8b5cf6', budget: 3000, actual: 3500 },
  { name: '交通', color: '#14b8a6', budget: 1500, actual: 1200 },
  { name: '住房', color: '#3b82f6', budget: 8000, actual: 8000 },
  { name: '其他', color: '#64748b', budget: 2500, actual: 2800 },
];

function MarbleMesh({ marble, targetX, targetYBase, allMarbles, marbleIndex }) {
  const meshRef = useRef();
  const velocityRef = useRef(new THREE.Vector3(
    (Math.random() - 0.5) * 2,
    0,
    0
  ));
  const positionRef = useRef(new THREE.Vector3(
    (Math.random() - 0.5) * 6,
    14 + Math.random() * 4,
    (Math.random() - 0.5) * 2
  ));
  const elapsedRef = useRef(0);
  const bounceCountRef = useRef(0);
  const landedRef = useRef(false);
  const settleTimerRef = useRef(0);
  const impactRef = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    elapsedRef.current += delta;

    if (elapsedRef.current < marble.delay) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    const pos = positionRef.current;
    const vel = velocityRef.current;

    if (!landedRef.current) {
      vel.y -= 18 * delta;
      pos.addScaledVector(vel, delta);

      const dx = targetX - pos.x;
      vel.x += dx * delta * 4;
      vel.x *= 0.96;

      const dz = 0 - pos.z;
      vel.z += dz * delta * 2;
      vel.z *= 0.96;

      const floorY = targetYBase + marble.radius;
      if (pos.y <= floorY) {
        pos.y = floorY;
        bounceCountRef.current++;

        if (bounceCountRef.current <= 3 && Math.abs(vel.y) > 1) {
          vel.y = Math.abs(vel.y) * 0.45;
          vel.x *= 0.6;
          vel.z *= 0.6;
          impactRef.current = 1.0;
        } else {
          vel.y = 0;
          vel.x *= 0.2;
          vel.z = 0;
          landedRef.current = true;
        }
      }

      for (let i = 0; i < allMarbles.length; i++) {
        if (i === marbleIndex) continue;
        const other = allMarbles[i];
        if (!other.position) continue;
        const otherElapsed = (other.__elapsed || 0);
        if (otherElapsed < (other.delay || 0)) continue;

        const ox = other.position.x || 0;
        const oy = other.position.y || 0;
        const oz = other.position.z || 0;
        const dist = pos.distanceTo(new THREE.Vector3(ox, oy, oz));
        const minDist = marble.radius + (other.radius || 0.2);

        if (dist < minDist && dist > 0.001) {
          const normal = new THREE.Vector3().subVectors(pos, new THREE.Vector3(ox, oy, oz)).normalize();
          const overlap = minDist - dist;
          pos.addScaledVector(normal, overlap * 0.5);
          
          const relVel = vel.dot(normal);
          if (relVel < 0) {
            vel.addScaledVector(normal, -relVel * 1.2);
            impactRef.current = 0.5;
          }
        }
      }
    } else {
      settleTimerRef.current += delta;
      const dx = targetX - pos.x;
      const dz = 0 - pos.z;
      pos.x += dx * delta * 3;
      pos.z += dz * delta * 3;
    }

    if (impactRef.current > 0) {
      impactRef.current -= delta * 4;
      if (impactRef.current < 0) impactRef.current = 0;
    }

    const scale = 1 + impactRef.current * 0.3;
    meshRef.current.scale.set(scale, scale, scale);
    meshRef.current.position.copy(pos);

    marble.position = { x: pos.x, y: pos.y, z: pos.z };
    marble.__elapsed = elapsedRef.current;
  });

  const colors = BUDGET_CATEGORIES.map(c => c.color);
  const color = colors[marble.categoryIndex % colors.length];

  return (
    <mesh ref={meshRef} position={[positionRef.current.x, positionRef.current.y, 0]}>
      <sphereGeometry args={[marble.radius, 24, 24]} />
      <meshStandardMaterial
        color={color}
        metalness={0.4}
        roughness={0.3}
        emissive={color}
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

function BudgetSlot({ category, index, isSelected }) {
  const angle = (index / BUDGET_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
  const radius = 6;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * 0.6;

  const spentPercentage = (category.actual / category.budget) * 100;
  const isOverBudget = category.actual > category.budget;
  const overAmount = category.actual - category.budget;

  return (
    <group position={[x, y, 0]}>
      <mesh>
        <boxGeometry args={[2.5, 0.8, 0.3]} />
        <meshStandardMaterial
          color={isOverBudget ? '#7f1d1d' : isSelected ? category.color : '#1e293b'}
          emissive={isOverBudget ? '#ef4444' : category.color}
          emissiveIntensity={isOverBudget ? 0.6 : isSelected ? 0.3 : 0.1}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>

      {isOverBudget && (
        <>
          <mesh position={[0, 0, -0.2]}>
            <ringGeometry args={[1.3, 1.5, 32]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <ringGeometry args={[1.3, 1.5, 32]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}

      <Text
        position={[0, 0.6, 0.5]}
        fontSize={0.25}
        color={isOverBudget ? '#fca5a5' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {category.name}
      </Text>
      <Text
        position={[0, 0.25, 0.5]}
        fontSize={0.18}
        color={isOverBudget ? '#ef4444' : '#22c55e'}
        anchorX="center"
        anchorY="middle"
      >
        ¥{category.actual.toLocaleString()} / ¥{category.budget.toLocaleString()}
      </Text>
      {isOverBudget && (
        <Text
          position={[0, -0.1, 0.5]}
          fontSize={0.14}
          color="#f87171"
          anchorX="center"
          anchorY="middle"
        >
          超支 ¥{overAmount.toLocaleString()}!
        </Text>
      )}
      {!isOverBudget && (
        <Text
          position={[0, -0.1, 0.5]}
          fontSize={0.15}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
        >
          {spentPercentage.toFixed(0)}%
        </Text>
      )}
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[2.2, 0.15, 0.2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[-1.1 + (Math.min(spentPercentage, 100) / 100) * 1.1, -0.55, 0.11]}>
        <boxGeometry args={[Math.min(spentPercentage, 100) / 100 * 2.2, 0.15, 0.2]} />
        <meshStandardMaterial
          color={isOverBudget ? '#ef4444' : category.color}
          emissive={isOverBudget ? '#ef4444' : category.color}
          emissiveIntensity={isOverBudget ? 0.6 : 0.3}
        />
      </mesh>
    </group>
  );
}

function ParticleExplosion({ position, color, active }) {
  const particlesRef = useRef([]);
  const meshRefs = useRef([]);
  const MAX_PARTICLES = 12;

  useEffect(() => {
    if (!active) return;
    particlesRef.current = Array.from({ length: MAX_PARTICLES }, () => ({
      position: new THREE.Vector3(position[0], position[1], position[2]),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 4
      ),
      life: 1.0
    }));
  }, [active, position]);

  useFrame((state, delta) => {
    particlesRef.current.forEach((p, i) => {
      if (!p || p.life <= 0) return;
      p.velocity.y -= 12 * delta;
      p.position.addScaledVector(p.velocity, delta);
      p.life -= delta * 1.5;
      if (meshRefs.current[i]) {
        meshRefs.current[i].position.copy(p.position);
        meshRefs.current[i].scale.setScalar(p.life);
        meshRefs.current[i].visible = p.life > 0;
      }
    });
  });

  if (!active) return null;

  return (
    <>
      {Array.from({ length: MAX_PARTICLES }, (_, i) => (
        <mesh key={i} ref={el => meshRefs.current[i] = el} visible={false}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

function Scene({ scrollProgress, marbles, selectedCategory }) {
  const { camera } = useThree();
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    const targetY = 5 - scrollProgress * 30;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    timeRef.current += delta;
  });

  const getTargetX = (categoryIndex) => {
    const angle = (categoryIndex / BUDGET_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
    return Math.cos(angle) * 6;
  };

  const getTargetYBase = (categoryIndex) => {
    return -4;
  };

  const overBudgetCategories = BUDGET_CATEGORIES
    .map((c, i) => ({ ...c, index: i }))
    .filter(c => c.actual > c.budget);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />
      <directionalLight position={[0, 10, 5]} intensity={0.8} />

      <group position={[0, -5, -1]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[10, 64]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.3}
            roughness={0.8}
          />
        </mesh>
      </group>

      {BUDGET_CATEGORIES.map((category, index) => (
        <BudgetSlot
          key={category.name}
          category={category}
          index={index}
          isSelected={selectedCategory === index}
        />
      ))}

      {overBudgetCategories.map(c => (
        <ParticleExplosion
          key={`explosion-${c.index}`}
          position={[
            Math.cos((c.index / BUDGET_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2) * 6,
            Math.sin((c.index / BUDGET_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2) * 6 * 0.6,
            0.5
          ]}
          color="#ef4444"
          active={true}
        />
      ))}

      {marbles.map((marble, index) => (
        <MarbleMesh
          key={marble.id}
          marble={marble}
          targetX={getTargetX(marble.categoryIndex)}
          targetYBase={getTargetYBase(marble.categoryIndex)}
          allMarbles={marbles}
          marbleIndex={index}
        />
      ))}

      <group position={[0, 12, 0]}>
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.3, 0.5, 1, 32]} />
          <meshStandardMaterial
            color="#fbbf24"
            metalness={0.8}
            roughness={0.2}
            emissive="#fbbf24"
            emissiveIntensity={0.3}
          />
        </mesh>
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.8}
          color="#fbbf24"
          anchorX="center"
          anchorY="middle"
        >
          💰
        </Text>
      </group>

      {scrollProgress < 0.2 && (
        <group position={[0, 10, 0]}>
          <Text
            fontSize={0.8}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            资金流向沙盘
          </Text>
          <Text
            position={[0, -1.2, 0]}
            fontSize={0.3}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            滚动页面查看资金流动过程
          </Text>
        </group>
      )}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

function ScrollytellingSandbox({ transactions }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const containerRef = useRef(null);

  const marbles = useMemo(() => {
    const marbleList = [];
    
    if (transactions && transactions.length > 0) {
      transactions.forEach((tx, index) => {
        const categoryIndex = BUDGET_CATEGORIES.findIndex(
          c => c.name.toLowerCase() === (tx.category || '其他').toLowerCase()
        );
        const actualIndex = categoryIndex >= 0 ? categoryIndex : BUDGET_CATEGORIES.length - 1;
        
        marbleList.push({
          id: tx.id || `marble-${index}`,
          amount: tx.amount || 100,
          categoryIndex: actualIndex,
          radius: Math.max(0.15, Math.min(0.6, (tx.amount || 100) / 2000)),
          position: null,
          delay: index * 0.35 + Math.random() * 0.2,
          __elapsed: 0
        });
      });
    } else {
      BUDGET_CATEGORIES.forEach((category, catIndex) => {
        const numMarbles = Math.floor(category.actual / 500);
        for (let i = 0; i < Math.min(numMarbles, 5); i++) {
          const amount = category.actual / Math.min(numMarbles, 5);
          
          marbleList.push({
            id: `marble-${catIndex}-${i}`,
            amount: amount,
            categoryIndex: catIndex,
            radius: Math.max(0.15, Math.min(0.6, amount / 2000)),
            position: null,
            delay: (catIndex * 5 + i) * 0.4 + Math.random() * 0.3,
            __elapsed: 0
          });
        }
      });
    }
    
    return marbleList;
  }, [transactions]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const progress = scrollTop / (scrollHeight - clientHeight);
        setScrollProgress(Math.max(0, Math.min(1, progress)));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const totalBudget = BUDGET_CATEGORIES.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = BUDGET_CATEGORIES.reduce((sum, c) => sum + c.actual, 0);
  const overBudgetCount = BUDGET_CATEGORIES.filter(c => c.actual > c.budget).length;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            资金流向沙盘
          </h2>
          <div className="flex gap-4 text-sm">
            <div className="text-right">
              <p className="text-gray-400">总预算</p>
              <p className="text-white font-semibold">¥{totalBudget.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400">已支出</p>
              <p className={`font-semibold ${totalSpent > totalBudget ? 'text-red-400' : 'text-green-400'}`}>
                ¥{totalSpent.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400">进度</p>
              <p className="text-indigo-400 font-semibold">
                {((totalSpent / totalBudget) * 100).toFixed(0)}%
              </p>
            </div>
            {overBudgetCount > 0 && (
              <div className="text-right">
                <p className="text-gray-400">超预算</p>
                <p className="text-red-400 font-semibold animate-pulse">
                  {overBudgetCount} 项
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {BUDGET_CATEGORIES.map((category, index) => {
            const isOver = category.actual > category.budget;
            return (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(selectedCategory === index ? null : index)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
                  selectedCategory === index
                    ? 'text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                } ${isOver ? 'ring-2 ring-red-500/50' : ''}`}
                style={selectedCategory === index ? { backgroundColor: category.color } : {}}
              >
                {category.name}
                {isOver && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div 
        ref={containerRef}
        className="h-[600px] overflow-y-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="h-[300vh] relative">
          <div className="sticky top-0 h-screen">
            <Canvas
              camera={{ position: [0, 5, 20], fov: 50 }}
              style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}
            >
              <Scene
                scrollProgress={scrollProgress}
                marbles={marbles}
                selectedCategory={selectedCategory}
              />
            </Canvas>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-800/30">
        <p className="text-sm text-gray-400 text-center">
          ↑ 滚动页面控制视角。弹珠依次掉落并碰撞，大小代表金额。红色脉冲 = 超预算类别。
        </p>
      </div>
    </div>
  );
}

export default ScrollytellingSandbox;
