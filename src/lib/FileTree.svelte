<script lang="ts">
	import type { DirNode } from './types';
	import Icon, { type IconName } from './Icon.svelte';
	import FileTree from './FileTree.svelte';

	let {
		nodes,
		selectedPath,
		onSelect,
		onContextMenu,
		onMove,
		depth = 0
	}: {
		nodes: DirNode[];
		selectedPath: string | null;
		onSelect: (node: DirNode) => void;
		onContextMenu: (node: DirNode, e: MouseEvent) => void;
		onMove: (sourcePath: string, targetFolderPath: string) => void;
		depth?: number;
	} = $props();

	// Estado de pastas expandidas/recolhidas, por caminho.
	let expanded = $state<Record<string, boolean>>({});
	let dragOverPath = $state<string | null>(null);

	function toggle(path: string) {
		expanded[path] = !expanded[path];
	}

	function iconFor(node: DirNode): IconName {
		if (node.kind === 'image') return 'image';
		if (node.kind === 'pdf') return 'picture-pdf';
		return 'description';
	}

	function onDragStart(e: DragEvent, node: DirNode) {
		e.dataTransfer?.setData('text/plain', node.path);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function onDragOverFolder(e: DragEvent, node: DirNode) {
		e.preventDefault();
		dragOverPath = node.path;
	}

	function onDropOnFolder(e: DragEvent, node: DirNode) {
		e.preventDefault();
		dragOverPath = null;
		const source = e.dataTransfer?.getData('text/plain');
		if (source && source !== node.path) onMove(source, node.path);
	}
</script>

<ul class="tree" style="--depth: {depth}">
	{#each nodes as node (node.path)}
		<li>
			{#if node.isDir}
				<button
					class="entry dir"
					class:drag-over={dragOverPath === node.path}
					draggable="true"
					onclick={() => toggle(node.path)}
					oncontextmenu={(e) => onContextMenu(node, e)}
					ondragstart={(e) => onDragStart(e, node)}
					ondragover={(e) => onDragOverFolder(e, node)}
					ondragleave={() => (dragOverPath = null)}
					ondrop={(e) => onDropOnFolder(e, node)}
				>
					<span class="chevron" class:open={expanded[node.path]}>
						<Icon name="chevron-right" size={14} />
					</span>
					<Icon name={expanded[node.path] ? 'folder-open' : 'folder'} size={15} />
					<span class="name">{node.name}</span>
				</button>
				{#if expanded[node.path] && node.children}
					<FileTree
						nodes={node.children}
						{selectedPath}
						{onSelect}
						{onContextMenu}
						{onMove}
						depth={depth + 1}
					/>
				{/if}
			{:else}
				<button
					class="entry file"
					class:selected={selectedPath === node.path}
					draggable="true"
					onclick={() => onSelect(node)}
					oncontextmenu={(e) => onContextMenu(node, e)}
					ondragstart={(e) => onDragStart(e, node)}
				>
					<Icon name={iconFor(node)} size={15} />
					<span class="name">{node.name}</span>
				</button>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.tree {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		border: none;
		background: none;
		padding: 4px 8px 4px calc(10px + var(--depth, 0) * 14px);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		color: var(--text);
		border-radius: 4px;
	}

	.entry:hover {
		background: var(--hover);
	}

	.entry.selected {
		background: var(--accent);
		color: var(--accent-text);
	}

	.entry.drag-over {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.12s ease;
		opacity: 0.7;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
