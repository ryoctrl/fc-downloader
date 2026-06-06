import { useEffect, useState } from 'react'
import type { ViewerNode } from '@shared/types'

export function ViewerPanel(): JSX.Element {
  const [tree, setTree] = useState<ViewerNode[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setTree(await window.api['viewer:tree']())
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="viewer">
      <div className="viewer__header">
        <h2>ライブラリ</h2>
        <button onClick={refresh}>再読み込み</button>
      </div>
      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : tree.length === 0 ? (
        <p className="muted">
          まだダウンロードされたコンテンツがありません。サービスを選んでダウンロードしてください。
        </p>
      ) : (
        <ul className="tree">
          {tree.map((node) => (
            <TreeNode key={node.key} node={node} depth={0} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TreeNode({ node, depth }: { node: ViewerNode; depth: number }): JSX.Element {
  const [open, setOpen] = useState(depth < 1)
  const hasChildren = node.children && node.children.length > 0

  return (
    <li className="tree__node">
      <div className="tree__row" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button className="tree__toggle" onClick={() => setOpen((o) => !o)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree__toggle" />
        )}
        <span className="tree__label">{node.label}</span>
        {node.kind === 'post' && (
          <>
            <span className="tree__meta">{node.fileCount ?? 0} ファイル</span>
            <button
              className="tree__open"
              onClick={() => node.path && window.api['viewer:openPath'](node.path)}
            >
              フォルダを開く
            </button>
          </>
        )}
      </div>
      {open && hasChildren && (
        <ul>
          {node.children!.map((child) => (
            <TreeNode key={child.key} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
