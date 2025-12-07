import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, Gauge, Network, Settings, Info, Volume2, VolumeX, Target } from 'lucide-react';
import { HashRouter as Router } from 'react-router-dom';
const NDNGame = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [cacheHits, setCacheHits] = useState(0);
  const [packetsSent, setPacketsSent] = useState(0);
  const [packetsDelivered, setPacketsDelivered] = useState(0);
  const [packetsLost, setPacketsLost] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [congestionLevel, setCongestionLevel] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [speed, setSpeed] = useState('normal');
  const [topology, setTopology] = useState('simple');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [packetLoss, setPacketLoss] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [levelObjective, setLevelObjective] = useState({ delivered: 20, cacheHitPercent: 50 });
  const [showSettings, setShowSettings] = useState(false);
  
  const gameRef = useRef({
    nodes: [],
    packets: [],
    maxPackets: 10,
    levelTime: 90,
    dataNames: ['/sensor/temp', '/sensor/humidity', '/sensor/light', '/camera/feed', '/actuator/control']
  });

  const WIDTH = 1200;
  const HEIGHT = 700;

  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'interest') {
        oscillator.frequency.value = 440;
        gainNode.gain.value = 0.1;
      } else if (type === 'data') {
        oscillator.frequency.value = 550;
        gainNode.gain.value = 0.1;
      } else if (type === 'cache') {
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.15;
      }
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  const getSpeedMultiplier = () => {
    switch(speed) {
      case 'slow': return 0.5;
      case 'fast': return 2.0;
      default: return 1.0;
    }
  };

  useEffect(() => {
    if (gameState === 'playing') {
      setupLevel();
    }
  }, [level, gameState, topology]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      updateGame();
      drawGame();
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [gameState, timeElapsed, score, speed]);

  const setupLevel = () => {
    const game = gameRef.current;
    game.nodes = [];
    game.packets = [];
    
    if (topology === 'simple') {
      const consumer = createNode(150, HEIGHT/2, 'consumer', 'C1');
      const router1 = createNode(400, HEIGHT/2, 'router', 'R1');
      const producer1 = createNode(650, HEIGHT/2 - 100, 'producer', 'P1');
      const producer2 = createNode(650, HEIGHT/2 + 100, 'producer', 'P2');
      
      consumer.neighbors = [router1];
      router1.neighbors = [consumer, producer1, producer2];
      producer1.neighbors = [router1];
      producer2.neighbors = [router1];
      
      game.nodes = [consumer, router1, producer1, producer2];
      game.maxPackets = 8;
    } else if (topology === 'mesh') {
      const consumer1 = createNode(100, 200, 'consumer', 'C1');
      const consumer2 = createNode(100, 600, 'consumer', 'C2');
      const router1 = createNode(300, 250, 'router', 'R1');
      const router2 = createNode(300, 550, 'router', 'R2');
      const router3 = createNode(600, 400, 'router', 'R3');
      const producer1 = createNode(900, 200, 'producer', 'P1');
      const producer2 = createNode(900, 400, 'producer', 'P2');
      const producer3 = createNode(900, 600, 'producer', 'P3');
      
      consumer1.neighbors = [router1];
      consumer2.neighbors = [router2];
      router1.neighbors = [consumer1, router2, router3];
      router2.neighbors = [consumer2, router1, router3];
      router3.neighbors = [router1, router2, producer1, producer2, producer3];
      producer1.neighbors = [router3];
      producer2.neighbors = [router3];
      producer3.neighbors = [router3];
      
      game.nodes = [consumer1, consumer2, router1, router2, router3, producer1, producer2, producer3];
      game.maxPackets = 15;
    } else if (topology === 'star') {
      const consumer1 = createNode(200, 200, 'consumer', 'C1');
      const consumer2 = createNode(200, 500, 'consumer', 'C2');
      const router1 = createNode(500, 350, 'router', 'R1');
      const producer1 = createNode(800, 200, 'producer', 'P1');
      const producer2 = createNode(800, 350, 'producer', 'P2');
      const producer3 = createNode(800, 500, 'producer', 'P3');
      
      consumer1.neighbors = [router1];
      consumer2.neighbors = [router1];
      router1.neighbors = [consumer1, consumer2, producer1, producer2, producer3];
      producer1.neighbors = [router1];
      producer2.neighbors = [router1];
      producer3.neighbors = [router1];
      
      game.nodes = [consumer1, consumer2, router1, producer1, producer2, producer3];
      game.maxPackets = 12;
    } else if (topology === 'tree') {
      const consumer1 = createNode(100, 250, 'consumer', 'C1');
      const consumer2 = createNode(100, 550, 'consumer', 'C2');
      const router1 = createNode(300, 250, 'router', 'R1');
      const router2 = createNode(300, 550, 'router', 'R2');
      const router3 = createNode(600, 400, 'router', 'R3');
      const router4 = createNode(850, 300, 'router', 'R4');
      const router5 = createNode(850, 500, 'router', 'R5');
      const producer1 = createNode(1050, 250, 'producer', 'P1');
      const producer2 = createNode(1050, 400, 'producer', 'P2');
      const producer3 = createNode(1050, 550, 'producer', 'P3');
      
      consumer1.neighbors = [router1];
      consumer2.neighbors = [router2];
      router1.neighbors = [consumer1, router3];
      router2.neighbors = [consumer2, router3];
      router3.neighbors = [router1, router2, router4, router5];
      router4.neighbors = [router3, producer1];
      router5.neighbors = [router3, producer2, producer3];
      producer1.neighbors = [router4];
      producer2.neighbors = [router5];
      producer3.neighbors = [router5];
      
      game.nodes = [consumer1, consumer2, router1, router2, router3, router4, router5, producer1, producer2, producer3];
      game.maxPackets = 18;
    }
    
    setTimeElapsed(0);
    setLevelObjective({ 
      delivered: topology === 'simple' ? 20 : 30, 
      cacheHitPercent: 50 
    });
    drawGame();
  };

  const createNode = (x, y, type, name) => ({
    x, y, type, name,
    radius: 30,
    neighbors: [],
    contentStore: {},
    pit: {},
    fib: {},
    csSize: 3,
    cacheHits: 0,
    pulse: 0
  });

  const sendInterest = (consumer, dataName) => {
    const game = gameRef.current;
    if (game.packets.length >= game.maxPackets) return;
    
    if (consumer.neighbors.length > 0) {
      const target = consumer.neighbors[0];
      const baseSpeed = Math.max(3.0 - (congestionLevel * 0.5), 1.0);
      const speed = baseSpeed * getSpeedMultiplier();
      const packet = {
        type: 'interest',
        name: dataName,
        x: consumer.x,
        y: consumer.y,
        targetX: target.x,
        targetY: target.y,
        speed,
        source: consumer,
        target,
        hops: 0,
        retries: 0
      };
      game.packets.push(packet);
      setPacketsSent(prev => prev + 1);
      playSound('interest');
    }
  };

  const routePacket = (packet) => {
    const game = gameRef.current;
    const current = packet.target;
    
    if (packetLoss && Math.random() < 0.05) {
      setPacketsLost(prev => prev + 1);
      return;
    }
    
    if (packet.type === 'interest') {
      current.pit[packet.name] = packet.source;
      
      if (current.type === 'router' && current.contentStore[packet.name]) {
        current.cacheHits++;
        setCacheHits(prev => prev + 1);
        setScore(prev => prev + 20);
        current.pulse = Math.PI;
        createDataPacket(current, packet.source, packet.name);
        playSound('cache');
        delete current.pit[packet.name];
        return;
      }
      
      if (current.type === 'producer') {
        createDataPacket(current, packet.source, packet.name);
        delete current.pit[packet.name];
      } else {
        let target;
        const producers = current.neighbors.filter(n => n.type === 'producer');
        if (producers.length > 0) {
          target = producers[Math.floor(Math.random() * producers.length)];
        } else {
          const routers = current.neighbors.filter(n => n.type === 'router');
          if (routers.length > 0) {
            target = routers[Math.floor(Math.random() * routers.length)];
          } else {
            const allProducers = game.nodes.filter(n => n.type === 'producer');
            if (allProducers.length > 0) {
              target = allProducers[Math.floor(Math.random() * allProducers.length)];
            } else {
              return;
            }
          }
        }
        
        const baseSpeed = Math.max(3.0 - (congestionLevel * 0.5), 1.0);
        const speed = baseSpeed * getSpeedMultiplier();
        game.packets.push({
          type: 'interest',
          name: packet.name,
          x: current.x,
          y: current.y,
          targetX: target.x,
          targetY: target.y,
          speed,
          source: packet.source,
          target,
          hops: packet.hops + 1,
          retries: packet.retries
        });
      }
    } else {
      if (current === packet.source) {
        setPacketsDelivered(prev => prev + 1);
        setScore(prev => prev + 10);
        current.pulse = Math.PI;
        playSound('data');
      } else {
        const nextHop = findNextHop(current, packet.source);
        if (nextHop) {
          const baseSpeed = Math.max(3.0 - (congestionLevel * 0.5), 1.0);
          const speed = baseSpeed * getSpeedMultiplier();
          game.packets.push({
            type: 'data',
            name: packet.name,
            x: current.x,
            y: current.y,
            targetX: nextHop.x,
            targetY: nextHop.y,
            speed,
            source: packet.source,
            target: nextHop,
            hops: packet.hops + 1
          });
        }
      }
    }
  };

  const createDataPacket = (producer, consumer, dataName) => {
    const game = gameRef.current;
    const nextHop = findNextHop(producer, consumer);
    if (nextHop) {
      const baseSpeed = Math.max(3.0 - (congestionLevel * 0.5), 1.0);
      const speed = baseSpeed * getSpeedMultiplier();
      game.packets.push({
        type: 'data',
        name: dataName,
        x: producer.x,
        y: producer.y,
        targetX: nextHop.x,
        targetY: nextHop.y,
        speed,
        source: consumer,
        target: nextHop,
        hops: 0
      });
      
      game.nodes.forEach(node => {
        if (node.type === 'router') {
          const path = getPath(producer, consumer);
          if (path.includes(node)) {
            if (Object.keys(node.contentStore).length >= node.csSize) {
              const oldest = Object.keys(node.contentStore)[0];
              delete node.contentStore[oldest];
            }
            node.contentStore[dataName] = true;
          }
        }
      });
    }
  };

  const findNextHop = (fromNode, toNode) => {
    if (fromNode.neighbors.includes(toNode)) {
      return toNode;
    }
    if (fromNode.neighbors.length > 0) {
      return fromNode.neighbors.reduce((closest, n) => {
        const distN = Math.sqrt((n.x - toNode.x) ** 2 + (n.y - toNode.y) ** 2);
        const distClosest = Math.sqrt((closest.x - toNode.x) ** 2 + (closest.y - toNode.y) ** 2);
        return distN < distClosest ? n : closest;
      });
    }
    return null;
  };

  const getPath = (fromNode, toNode) => {
    const visited = new Set();
    const queue = [[fromNode, [fromNode]]];
    
    while (queue.length > 0) {
      const [current, path] = queue.shift();
      if (current === toNode) return path;
      if (visited.has(current)) continue;
      visited.add(current);
      
      current.neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push([neighbor, [...path, neighbor]]);
        }
      });
    }
    return [];
  };

  const updateGame = () => {
    const game = gameRef.current;
    const speedMult = getSpeedMultiplier();
    
    setTimeElapsed(prev => {
      const newTime = prev + (1/60) * speedMult;
      if (newTime >= game.levelTime) {
        const objectiveMet = packetsDelivered >= levelObjective.delivered && 
                            (packetsSent > 0 ? (cacheHits / packetsSent * 100) >= levelObjective.cacheHitPercent : false);
        
        if (objectiveMet) {
          if (level === 1) {
            setGameState('level_complete');
          } else {
            setGameState('game_over');
            setLeaderboard(prev => {
              const newBoard = [...prev, score].sort((a, b) => b - a).slice(0, 5);
              return newBoard;
            });
          }
        } else {
          setGameState('game_over');
        }
      }
      return newTime;
    });
    
    setCongestionLevel(game.packets.length / game.maxPackets);
    
    game.nodes.forEach(node => {
      node.pulse += 0.05 * speedMult;
    });
    
    const packetsToRemove = [];
    game.packets.forEach(packet => {
      const dx = packet.targetX - packet.x;
      const dy = packet.targetY - packet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < packet.speed) {
        routePacket(packet);
        packetsToRemove.push(packet);
      } else {
        packet.x += (dx / dist) * packet.speed;
        packet.y += (dy / dist) * packet.speed;
      }
    });
    
    game.packets = game.packets.filter(p => !packetsToRemove.includes(p));
    
    if (Math.random() < (0.02 + (topology !== 'simple' ? 0.03 : 0)) * speedMult) {
      const consumers = game.nodes.filter(n => n.type === 'consumer');
      if (consumers.length > 0) {
        const consumer = consumers[Math.floor(Math.random() * consumers.length)];
        const dataName = game.dataNames[Math.floor(Math.random() * game.dataNames.length)];
        sendInterest(consumer, dataName);
      }
    }
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, '#1a0b2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    game.nodes.forEach(node => {
      node.neighbors.forEach(neighbor => {
        ctx.strokeStyle = congestionLevel > 0.7 ? '#ff1744' : congestionLevel > 0.4 ? '#ffa726' : '#d8b4fe';
        ctx.lineWidth = 3 + (congestionLevel * 3);
        ctx.shadowColor = congestionLevel > 0.7 ? '#ff1744' : 'transparent';
        ctx.shadowBlur = congestionLevel > 0.7 ? 10 : 0;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(neighbor.x, neighbor.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    });
    
    game.nodes.forEach(node => {
      const colors = {
        consumer: '#ec4899',
        router: '#f472b6',
        producer: '#c026d3'
      };
      
      const pulseSize = node.radius + Math.abs(Math.sin(node.pulse)) * 4;
      
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, pulseSize);
      gradient.addColorStop(0, colors[node.type]);
      gradient.addColorStop(1, colors[node.type] + '99');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.shadowColor = colors[node.type];
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, node.x, node.y);
      
      if (node.type === 'router' && node.cacheHits > 0) {
        ctx.fillStyle = '#a855f7';
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        ctx.fillText(`Cache: ${node.cacheHits}`, node.x, node.y + 40);
      }
    });
    
    game.packets.forEach(packet => {
      const color = packet.type === 'interest' ? '#ec4899' : '#c026d3';
      
      const gradient = ctx.createRadialGradient(packet.x, packet.y, 0, packet.x, packet.y, 12);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '66');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(packet.x, packet.y, 12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const handleCanvasClick = (e) => {
    if (gameState !== 'playing') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const game = gameRef.current;
    game.nodes.forEach(node => {
      if (node.type === 'consumer') {
        const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
        if (dist < node.radius) {
          const dataName = game.dataNames[Math.floor(Math.random() * game.dataNames.length)];
          sendInterest(node, dataName);
        }
      }
    });
  };

  const handleCanvasHover = (e) => {
    if (gameState !== 'playing') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const game = gameRef.current;
    let found = null;
    
    game.nodes.forEach(node => {
      const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (dist < node.radius) {
        found = node;
      }
    });
    
    setHoveredNode(found);
    setShowTooltip(found !== null);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const startGame = () => {
    setGameState('playing');
    setLevel(1);
    setScore(0);
    setCacheHits(0);
    setPacketsSent(0);
    setPacketsDelivered(0);
    setPacketsLost(0);
    setTimeElapsed(0);
  };

  const nextLevel = () => {
    setLevel(2);
    setGameState('playing');
  };

  const sendRandomInterest = () => {
    if (gameState !== 'playing') return;
    const game = gameRef.current;
    const consumers = game.nodes.filter(n => n.type === 'consumer');
    if (consumers.length > 0) {
      const consumer = consumers[Math.floor(Math.random() * consumers.length)];
      const dataName = game.dataNames[Math.floor(Math.random() * game.dataNames.length)];
      sendInterest(consumer, dataName);
    }
  };

  const getCongestionColor = () => {
    if (congestionLevel < 0.5) return 'text-emerald-400';
    if (congestionLevel < 0.8) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getObjectiveProgress = () => {
    const deliveredProgress = Math.min((packetsDelivered / levelObjective.delivered) * 100, 100);
    const cacheProgress = packetsSent > 0 ? Math.min(((cacheHits / packetsSent * 100) / levelObjective.cacheHitPercent) * 100, 100) : 0;
    return { deliveredProgress, cacheProgress };
  };

  const { deliveredProgress, cacheProgress } = getObjectiveProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-fuchsia-900 flex items-center justify-center p-6">
      <div className="bg-gradient-to-br from-pink-950/90 to-purple-950/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-7xl w-full border-2 border-pink-500/30">
        <div className="text-center mb-6">
          <h1 className="text-6xl font-black mb-3 bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent drop-shadow-2xl">
            NDN IoT Network Simulator
          </h1>
          <p className="text-pink-300 text-lg font-semibold tracking-wide">Professional Network Simulation Platform</p>
        </div>
        
        {gameState === 'menu' && (
          <div className="text-center space-y-8 py-8">
            <div className="bg-gradient-to-br from-pink-900/50 to-purple-900/50 rounded-3xl p-10 max-w-4xl mx-auto border-2 border-pink-500/40 shadow-2xl">
              <h2 className="text-4xl font-bold text-pink-200 mb-4">Welcome to Named Data Networking</h2>
              <p className="text-pink-300 mb-8 text-xl">Experience the future of IoT network architecture through interactive simulation</p>
              
              <div className="grid md:grid-cols-3 gap-6 text-left mb-8">
                <div className="bg-gradient-to-br from-pink-800/60 to-purple-800/60 p-6 rounded-2xl shadow-xl border border-pink-500/30 hover:scale-105 transition-transform">
                  <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <div className="w-7 h-7 bg-white rounded-full"></div>
                  </div>
                  <h3 className="font-bold text-pink-200 mb-3 text-xl">Consumers</h3>
                  <p className="text-sm text-pink-300">Request data by sending Interest packets through the network</p>
                </div>
                
                <div className="bg-gradient-to-br from-pink-800/60 to-purple-800/60 p-6 rounded-2xl shadow-xl border border-pink-500/30 hover:scale-105 transition-transform">
                  <div className="w-14 h-14 bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <div className="w-7 h-7 bg-white rounded"></div>
                  </div>
                  <h3 className="font-bold text-pink-200 mb-3 text-xl">Routers</h3>
                  <p className="text-sm text-pink-300">Cache data packets with PIT/FIB/CS for improved efficiency</p>
                </div>
                
                <div className="bg-gradient-to-br from-pink-800/60 to-purple-800/60 p-6 rounded-2xl shadow-xl border border-pink-500/30 hover:scale-105 transition-transform">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <div className="w-7 h-7 bg-white rounded-full"></div>
                  </div>
                  <h3 className="font-bold text-pink-200 mb-3 text-xl">Producers</h3>
                  <p className="text-sm text-pink-300">Respond with Data packets to satisfy consumer requests</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-900/60 to-fuchsia-900/60 rounded-2xl p-6 border border-purple-500/30 mb-8">
                <h3 className="font-bold text-xl text-purple-200 mb-4 flex items-center gap-2">
                  <Network className="text-purple-400" />
                  Select Network Topology
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { name: 'simple', label: 'Simple', desc: 'Basic 4-node network' },
                    { name: 'star', label: 'Star', desc: 'Central hub topology' },
                    { name: 'mesh', label: 'Mesh', desc: 'Interconnected network' },
                    { name: 'tree', label: 'Tree', desc: 'Hierarchical structure' }
                  ].map(topo => (
                    <button
                      key={topo.name}
                      onClick={() => setTopology(topo.name)}
                      className={`p-4 rounded-xl font-bold transition-all ${
                        topology === topo.name 
                          ? 'bg-gradient-to-br from-pink-500 to-fuchsia-500 text-white shadow-xl scale-105' 
                          : 'bg-purple-800/40 text-purple-200 hover:bg-purple-700/60'
                      }`}
                    >
                      <div className="text-lg mb-1">{topo.label}</div>
                      <div className="text-xs opacity-80">{topo.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-fuchsia-900/60 to-pink-900/60 rounded-2xl p-6 border border-fuchsia-500/30 mb-8">
                <h3 className="font-bold text-xl text-fuchsia-200 mb-4 flex items-center gap-2">
                  <Settings className="text-fuchsia-400" />
                  Advanced Settings
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setPacketLoss(!packetLoss)}
                    className={`p-4 rounded-xl font-semibold transition-all ${
                      packetLoss 
                        ? 'bg-gradient-to-br from-rose-500 to-red-500 text-white' 
                        : 'bg-fuchsia-800/40 text-fuchsia-200 hover:bg-fuchsia-700/60'
                    }`}
                  >
                    <div className="text-sm">Packet Loss: {packetLoss ? 'ON' : 'OFF'}</div>
                    <div className="text-xs opacity-80 mt-1">Simulate 5% packet drop rate</div>
                  </button>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      soundEnabled 
                        ? 'bg-gradient-to-br from-emerald-500 to-green-500 text-white' 
                        : 'bg-fuchsia-800/40 text-fuchsia-200 hover:bg-fuchsia-700/60'
                    }`}
                  >
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    <div>
                      <div className="text-sm">Audio: {soundEnabled ? 'ON' : 'OFF'}</div>
                      <div className="text-xs opacity-80">Sound effects for events</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-pink-800/60 to-purple-800/60 rounded-2xl p-6 max-w-2xl mx-auto shadow-xl border-2 border-pink-400/40">
              <h3 className="font-bold text-xl text-pink-200 mb-4 flex items-center gap-2 justify-center">
                <Info className="text-pink-400" />
                How to Play
              </h3>
              <div className="space-y-3 text-sm text-pink-200">
                <p className="flex items-start gap-2">
                  <span className="text-pink-400 font-bold">•</span>
                  Click on <span className="font-semibold text-pink-300">pink consumer nodes</span> to send Interest packets
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-pink-400 font-bold">•</span>
                  Hover over nodes to see their <span className="font-semibold text-pink-300">PIT, FIB, and Content Store</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-pink-400 font-bold">•</span>
                  Complete objectives: deliver packets and maximize <span className="font-semibold text-pink-300">cache hits</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-pink-400 font-bold">•</span>
                  Watch congestion levels and adjust your <span className="font-semibold text-pink-300">traffic patterns</span>
                </p>
              </div>
            </div>
            
            <button
              onClick={startGame}
              className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white px-16 py-5 rounded-2xl text-2xl font-black hover:shadow-2xl transform hover:scale-105 transition-all duration-200 border-4 border-pink-300/50 shadow-pink-500/50 shadow-xl"
            >
              🚀 Launch Simulation
            </button>
          </div>
        )}
        
        {gameState === 'playing' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-pink-900/60 to-purple-900/60 p-6 rounded-2xl border-2 border-pink-400/40 shadow-xl">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div className="bg-gradient-to-br from-pink-800/80 to-pink-900/80 p-4 rounded-xl text-center shadow-lg border border-pink-400/30">
                  <p className="text-xs text-pink-300 font-medium mb-1">Level</p>
                  <p className="text-3xl font-bold text-pink-200">{level}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-800/80 to-purple-900/80 p-4 rounded-xl text-center shadow-lg border border-purple-400/30">
                  <p className="text-xs text-purple-300 font-medium mb-1">Score</p>
                  <p className="text-3xl font-bold text-purple-200">{score}</p>
                </div>
                <div className="bg-gradient-to-br from-fuchsia-800/80 to-fuchsia-900/80 p-4 rounded-xl text-center shadow-lg border border-fuchsia-400/30">
                  <p className="text-xs text-fuchsia-300 font-medium mb-1">Time</p>
                  <p className="text-3xl font-bold text-fuchsia-200">{Math.max(0, Math.floor(gameRef.current.levelTime - timeElapsed))}s</p>
                </div>
                <div className="bg-gradient-to-br from-pink-800/80 to-pink-900/80 p-4 rounded-xl text-center shadow-lg border border-pink-400/30">
                  <p className="text-xs text-pink-300 font-medium mb-1">Cache Hits</p>
                  <p className="text-3xl font-bold text-pink-200">{cacheHits}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-800/80 to-emerald-900/80 p-4 rounded-xl text-center shadow-lg border border-emerald-400/30">
                  <p className="text-xs text-emerald-300 font-medium mb-1">Delivered</p>
                  <p className="text-3xl font-bold text-emerald-200">{packetsDelivered}/{packetsSent}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-800/80 to-amber-900/80 p-4 rounded-xl text-center shadow-lg border border-amber-400/30">
                  <p className="text-xs text-amber-300 font-medium mb-1">Congestion</p>
                  <p className={`text-3xl font-bold ${getCongestionColor()}`}>
                    {Math.round(congestionLevel * 100)}%
                  </p>
                </div>
              </div>

              <div className="bg-purple-900/40 rounded-xl p-4 mb-4 border border-purple-400/30">
                <div className="flex items-center gap-3 mb-3">
                  <Target className="text-pink-400" size={24} />
                  <h3 className="text-lg font-bold text-pink-200">Level Objectives</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm text-pink-300 mb-1">
                      <span>Packets Delivered: {packetsDelivered}/{levelObjective.delivered}</span>
                      <span>{Math.round(deliveredProgress)}%</span>
                    </div>
                    <div className="w-full bg-purple-900/60 rounded-full h-3 overflow-hidden border border-pink-500/30">
                      <div 
                        className="bg-gradient-to-r from-pink-500 to-fuchsia-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${deliveredProgress}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm text-purple-300 mb-1">
                      <span>Cache Hit Rate: {packetsSent > 0 ? Math.round((cacheHits/packetsSent)*100) : 0}% / {levelObjective.cacheHitPercent}%</span>
                      <span>{Math.round(cacheProgress)}%</span>
                    </div>
                    <div className="w-full bg-purple-900/60 rounded-full h-3 overflow-hidden border border-purple-500/30">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${cacheProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Gauge className="text-pink-400" size={24} />
                  <span className="text-sm font-medium text-pink-300">Speed:</span>
                  <div className="flex gap-2">
                    {['slow', 'normal', 'fast'].map(s => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                          speed === s 
                            ? 'bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-lg scale-105' 
                            : 'bg-purple-800/60 text-purple-200 hover:bg-purple-700/80'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-pink-300">
                  <span className="text-sm font-medium">Lost: {packetsLost}</span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={WIDTH}
                height={HEIGHT}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasHover}
                onMouseLeave={() => setShowTooltip(false)}
                className="border-4 border-pink-400/40 rounded-2xl cursor-pointer w-full shadow-2xl"
                style={{ maxHeight: '500px' }}
              />
              
              {showTooltip && hoveredNode && (
                <div 
                  className="absolute bg-gradient-to-br from-pink-900/95 to-purple-900/95 backdrop-blur-sm border-2 border-pink-400/50 rounded-xl p-4 shadow-2xl pointer-events-none z-10"
                  style={{ 
                    left: `${tooltipPos.x + 20}px`, 
                    top: `${tooltipPos.y + 20}px`,
                    maxWidth: '250px'
                  }}
                >
                  <h4 className="font-bold text-pink-200 mb-2 text-lg">{hoveredNode.name} - {hoveredNode.type.toUpperCase()}</h4>
                  {hoveredNode.type === 'router' && (
                    <div className="space-y-2 text-sm">
                      <div className="bg-purple-800/60 p-2 rounded-lg border border-purple-400/30">
                        <p className="text-purple-300 font-semibold">Content Store (CS):</p>
                        <p className="text-pink-200 text-xs">{Object.keys(hoveredNode.contentStore).length > 0 ? Object.keys(hoveredNode.contentStore).join(', ') : 'Empty'}</p>
                      </div>
                      <div className="bg-pink-800/60 p-2 rounded-lg border border-pink-400/30">
                        <p className="text-pink-300 font-semibold">PIT Entries:</p>
                        <p className="text-pink-200 text-xs">{Object.keys(hoveredNode.pit).length > 0 ? Object.keys(hoveredNode.pit).length + ' pending' : 'None'}</p>
                      </div>
                      <div className="bg-fuchsia-800/60 p-2 rounded-lg border border-fuchsia-400/30">
                        <p className="text-fuchsia-300 font-semibold">Cache Hits:</p>
                        <p className="text-pink-200 text-xs">{hoveredNode.cacheHits}</p>
                      </div>
                    </div>
                  )}
                  {hoveredNode.type === 'consumer' && (
                    <p className="text-pink-300 text-sm">Click to send Interest packet</p>
                  )}
                  {hoveredNode.type === 'producer' && (
                    <p className="text-pink-300 text-sm">Responds to Interest packets with Data</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={sendRandomInterest}
                className="bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white px-8 py-3 rounded-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all flex items-center gap-2 border-2 border-pink-300/50"
              >
                <Zap size={20} />
                Send Interest
              </button>
              <button
                onClick={() => setGameState('menu')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all flex items-center gap-2 border-2 border-purple-300/50"
              >
                <RotateCcw size={20} />
                Menu
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`px-6 py-3 rounded-xl font-bold hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2 border-2 ${
                  soundEnabled 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 border-emerald-300/50' 
                    : 'bg-gradient-to-r from-gray-600 to-gray-700 border-gray-400/50'
                } text-white`}
              >
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            </div>
          </div>
        )}
        
        {gameState === 'level_complete' && (
          <div className="text-center space-y-8 py-12">
            <div className="inline-block bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white px-10 py-4 rounded-full font-bold text-xl shadow-2xl border-2 border-pink-300">
              Level {level - 1} Complete! 🎉
            </div>
            <h2 className="text-6xl font-black text-transparent bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text">
              Excellent Performance
            </h2>
            <div className="bg-gradient-to-br from-pink-900/50 to-purple-900/50 rounded-3xl p-10 max-w-md mx-auto border-2 border-pink-400/40 shadow-2xl">
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-purple-800/40 p-4 rounded-xl border border-purple-400/30">
                  <span className="text-pink-300 font-semibold text-lg">Final Score</span>
                  <span className="text-4xl font-black text-transparent bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text">{score}</span>
                </div>
                <div className="flex justify-between items-center bg-fuchsia-800/40 p-4 rounded-xl border border-fuchsia-400/30">
                  <span className="text-pink-300 font-semibold text-lg">Cache Hits</span>
                  <span className="text-4xl font-black text-transparent bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text">{cacheHits}</span>
                </div>
                <div className="flex justify-between items-center bg-pink-800/40 p-4 rounded-xl border border-pink-400/30">
                  <span className="text-pink-300 font-semibold text-lg">Efficiency</span>
                  <span className="text-4xl font-black text-transparent bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text">
                    {packetsSent > 0 ? Math.round((packetsDelivered / packetsSent) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={nextLevel}
              className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white px-16 py-5 rounded-2xl text-2xl font-black hover:shadow-2xl transform hover:scale-105 transition-all duration-200 border-4 border-pink-300/50"
            >
              Proceed to Level 2 →
            </button>
          </div>
        )}
        
        {gameState === 'game_over' && (
          <div className="text-center space-y-8 py-12">
            <div className="inline-block bg-gradient-to-r from-emerald-500 to-green-500 text-white px-10 py-4 rounded-full font-bold text-xl shadow-2xl border-2 border-emerald-300">
              Simulation Complete! 🏆
            </div>
            <h2 className="text-6xl font-black text-transparent bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text">
              Outstanding Results
            </h2>
            <div className="bg-gradient-to-br from-pink-900/50 to-purple-900/50 rounded-3xl p-10 max-w-md mx-auto border-2 border-pink-400/40 shadow-2xl">
              <p className="text-3xl font-bold text-pink-300 mb-4">Final Score</p>
              <p className="text-7xl font-black text-transparent bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text">{score}</p>
            </div>
            
            {leaderboard.length > 0 && (
              <div className="max-w-md mx-auto bg-gradient-to-br from-yellow-900/40 to-pink-900/40 p-8 rounded-3xl border-2 border-yellow-500/40 shadow-2xl">
                <h3 className="text-3xl font-bold mb-6 text-yellow-300 flex items-center justify-center gap-2">
                  🏆 Top Scores
                </h3>
                <div className="space-y-3">
                  {leaderboard.map((s, i) => (
                    <div key={i} className="flex justify-between items-center bg-gradient-to-r from-pink-800/60 to-purple-800/60 px-6 py-4 rounded-xl shadow-lg border border-pink-400/30">
                      <span className="font-black text-2xl text-yellow-300">#{i + 1}</span>
                      <span className="text-3xl font-black text-transparent bg-gradient-to-r from-pink-400 to-fuchsia-400 bg-clip-text">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={startGame}
              className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white px-16 py-5 rounded-2xl text-2xl font-black hover:shadow-2xl transform hover:scale-105 transition-all duration-200 border-4 border-pink-300/50"
            >
              🚀 Start New Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NDNGame;