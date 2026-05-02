import React, { useRef, useEffect, useState, useMemo } from 'react';
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

class Marble {
  constructor(id, amount, categoryIndex, startX, startY) {
    this.id = id;
    this.amount = amount;
    this.categoryIndex = categoryIndex;
    this.radius = Math.max(0.15, Math.min(0.6, amount / 2000));
    this.position = new THREE.Vector3(startX, startY, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.isFalling = true;
    this.hasLanded = false;
    this.targetY = -4;
  }

  update(deltaTime, targetX) {
    if (!this.hasLanded) {
      this.velocity.y -= 9.8 * deltaTime * 2;
      this.position.addScaledVector(this.velocity, deltaTime);
      
      const dx = targetX - this.position.x;
      this.velocity.x += dx * deltaTime * 3;
      this.velocity.x *= 0.95;
      
      if (this.position.y <= this.targetY + this.radius) {
        this.position.y = this.targetY + this.radius;
        this.velocity.y = 0;
        this.velocity.x *= 0.3;
        this.hasLanded = true;
      }
      
      if (Math.abs(this.position.x - targetX) < 0.1 && this.hasLanded) {
        this.position.x = targetX;
        this.velocity.x = 0;
      }
    }
    
    return this.position;
  }
}

function MarbleMesh({ marble, targetX }) {
  const meshRef = useRef();
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const positionRef = useRef(new THREE.Vector3(marble.position.x, marble.position.y, 0));

  useFrame((state, delta) => {
    if (meshRef.current && positionRef.current) {
      if (!marble.hasLanded) {
        velocityRef.current.y -= 9.8 * delta * 2;
        positionRef.current.addScaledVector(velocityRef.current, delta);
        
        const dx = targetX - positionRef.current.x;
        velocityRef.current.x += dx * delta * 3;
        velocityRef.current.x *= 0.95;
        
        const targetY = -4 + marble.radius;
        if (positionRef.current.y <= targetY) {
          positionRef.current.y = targetY;
          velocityRef.current.y = 0;
          velocityRef.current.x *= 0.3;
          marble.hasLanded = true;
        }
      }
      
      meshRef.current.position.copy(positionRef.current);
    }
  });

  const colors = BUDGET_CATEGORIES.map(c => c.color);
  const color = colors[marble.categoryIndex % colors.length];

  return (
    <mesh ref={meshRef} position={[positionRef.current.x, positionRef.current.y, 0]}>
      <sphereGeometry args={[marble.radius, 32, 32]} />
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.4}
        emissive={color}
        emissiveIntensity={0.2}
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

  return (
    <group position={[x, y, 0]}>
      <mesh>
        <boxGeometry args={[2.5, 0.8, 0.3]} />
        <meshStandardMaterial
          color={isSelected ? category.color : '#1e293b'}
          emissive={category.color}
          emissiveIntensity={isSelected ? 0.3 : 0.1}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>
      <Text
        position={[0, 0.6, 0.5]}
        fontSize={0.25}
        color="#ffffff"
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
      <Text
        position={[0, -0.1, 0.5]}
        fontSize={0.15}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {spentPercentage.toFixed(0)}%
      </Text>
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[2.2, 0.15, 0.2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[-1.1 + (Math.min(spentPercentage, 100) / 100) * 1.1, -0.55, 0.11]}>
        <boxGeometry args={[Math.min(spentPercentage, 100) / 100 * 2.2, 0.15, 0.2]} />
        <meshStandardMaterial
          color={isOverBudget ? '#ef4444' : category.color}
          emissive={isOverBudget ? '#ef4444' : category.color}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

function Scene({ scrollProgress, marbles, selectedCategory }) {
  const { camera } = useThree();
  
  useFrame(() => {
    const targetY = 5 - scrollProgress * 30;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
  });

  const getTargetX = (categoryIndex) => {
    const angle = (categoryIndex / BUDGET_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
    return Math.cos(angle) * 6;
  };

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

      {marbles.map((marble) => (
        <MarbleMesh
          key={marble.id}
          marble={marble}
          targetX={getTargetX(marble.categoryIndex)}
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
        
        const startY = 12 + Math.random() * 3;
        const startX = (Math.random() - 0.5) * 4;
        
        marbleList.push({
          id: tx.id || `marble-${index}`,
          amount: tx.amount || 100,
          categoryIndex: actualIndex,
          radius: Math.max(0.15, Math.min(0.6, (tx.amount || 100) / 2000)),
          position: { x: startX, y: startY, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          isFalling: true,
          hasLanded: false,
          delay: index * 0.1
        });
      });
    } else {
      BUDGET_CATEGORIES.forEach((category, catIndex) => {
        const numMarbles = Math.floor(category.actual / 500);
        for (let i = 0; i < Math.min(numMarbles, 5); i++) {
          const amount = category.actual / Math.min(numMarbles, 5);
          const startY = 12 + Math.random() * 3;
          const startX = (Math.random() - 0.5) * 4;
          
          marbleList.push({
            id: `marble-${catIndex}-${i}`,
            amount: amount,
            categoryIndex: catIndex,
            radius: Math.max(0.15, Math.min(0.6, amount / 2000)),
            position: { x: startX, y: startY, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            isFalling: true,
            hasLanded: false,
            delay: (catIndex * 5 + i) * 0.1
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
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {BUDGET_CATEGORIES.map((category, index) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(selectedCategory === index ? null : index)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === index
                  ? 'text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
              style={selectedCategory === index ? { backgroundColor: category.color } : {}}
            >
              {category.name}
            </button>
          ))}
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
          ↑ 滚动页面控制视角，查看资金从顶部流入各个类别的过程。弹珠大小代表金额，颜色对应类别。
        </p>
      </div>
    </div>
  );
}

export default ScrollytellingSandbox;
