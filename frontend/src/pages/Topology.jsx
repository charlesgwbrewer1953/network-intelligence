import { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { devicesApi } from '../api/client'

function buildGraph(devices) {
  const gatewayId = 'gateway'
  const nodes = [
    {
      id: gatewayId,
      data: { label: 'Gateway / Router' },
      position: { x: 400, y: 40 },
      style: {
        background: '#21262d',
        border: '2px solid #58a6ff',
        color: '#e6edf3',
        borderRadius: 8,
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 600,
      },
    },
  ]

  const edges = []
  const cols = 4
  const xSpacing = 200
  const ySpacing = 120

  devices.forEach((d, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = (col - (cols - 1) / 2) * xSpacing + 400
    const y = 200 + row * ySpacing

    const isOnline = d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 60 * 60 * 1000
    const label = d.user_name || d.hostname || d.primary_mac

    nodes.push({
      id: d.device_id,
      data: { label },
      position: { x, y },
      style: {
        background: '#161b22',
        border: `1px solid ${isOnline ? '#3fb950' : '#30363d'}`,
        color: '#e6edf3',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 12,
        minWidth: 120,
        textAlign: 'center',
      },
    })

    edges.push({
      id: `e-${d.device_id}`,
      source: gatewayId,
      target: d.device_id,
      style: { stroke: isOnline ? '#3fb950' : '#30363d' },
    })
  })

  return { nodes, edges }
}

export default function Topology() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    devicesApi.list()
      .then(d => {
        setDevices(d)
        const { nodes, edges } = buildGraph(d)
        setNodes(nodes)
        setEdges(edges)
      })
      .finally(() => setLoading(false))
  }, [])

  const onConnect = useCallback(
    (params) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  )

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Topology</h1>
          <p>Visual network map — {devices.length} device{devices.length !== 1 ? 's' : ''}. V1 uses inferred layout.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading">Building topology…</div>
      ) : (
        <div style={{ height: 600, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background color="#30363d" gap={24} />
            <Controls style={{ background: '#161b22', border: '1px solid #30363d' }} />
            <MiniMap
              style={{ background: '#161b22', border: '1px solid #30363d' }}
              nodeColor="#58a6ff"
            />
          </ReactFlow>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <span style={{ marginRight: 16 }}>
          <span style={{ color: 'var(--green)' }}>●</span> Online (seen within 1 hour)
        </span>
        <span>
          <span style={{ color: 'var(--border)' }}>●</span> Offline
        </span>
      </div>
    </>
  )
}
