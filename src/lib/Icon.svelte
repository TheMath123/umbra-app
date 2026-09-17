<script lang="ts" module>
	import folder from '@material-design-icons/svg/outlined/folder.svg?raw';
	import folderOpen from '@material-design-icons/svg/outlined/folder_open.svg?raw';
	import description from '@material-design-icons/svg/outlined/description.svg?raw';
	import image from '@material-design-icons/svg/outlined/image.svg?raw';
	import picturePdf from '@material-design-icons/svg/outlined/picture_as_pdf.svg?raw';
	import helpOutline from '@material-design-icons/svg/outlined/help_outline.svg?raw';
	import edit from '@material-design-icons/svg/outlined/edit.svg?raw';
	import deleteOutline from '@material-design-icons/svg/outlined/delete_outline.svg?raw';
	import pushPinOutlined from '@material-design-icons/svg/outlined/push_pin.svg?raw';
	import pushPinFilled from '@material-design-icons/svg/filled/push_pin.svg?raw';
	import close from '@material-design-icons/svg/outlined/close.svg?raw';
	import chevronRight from '@material-design-icons/svg/outlined/chevron_right.svg?raw';
	import add from '@material-design-icons/svg/outlined/add.svg?raw';
	import remove from '@material-design-icons/svg/outlined/remove.svg?raw';
	import moreHoriz from '@material-design-icons/svg/outlined/more_horiz.svg?raw';
	import settings from '@material-design-icons/svg/outlined/settings.svg?raw';
	import palette from '@material-design-icons/svg/outlined/palette.svg?raw';
	import formatSize from '@material-design-icons/svg/outlined/format_size.svg?raw';
	import textFormat from '@material-design-icons/svg/outlined/text_format.svg?raw';
	import keyboard from '@material-design-icons/svg/outlined/keyboard.svg?raw';
	import restore from '@material-design-icons/svg/outlined/restore.svg?raw';
	import uploadFile from '@material-design-icons/svg/outlined/upload_file.svg?raw';
	import download from '@material-design-icons/svg/outlined/download.svg?raw';
	import check from '@material-design-icons/svg/outlined/check.svg?raw';

	const icons = {
		folder,
		'folder-open': folderOpen,
		description,
		image,
		'picture-pdf': picturePdf,
		'help-outline': helpOutline,
		edit,
		'delete-outline': deleteOutline,
		'push-pin-outlined': pushPinOutlined,
		'push-pin-filled': pushPinFilled,
		close,
		'chevron-right': chevronRight,
		add,
		remove,
		'more-horiz': moreHoriz,
		settings,
		palette,
		'format-size': formatSize,
		'text-format': textFormat,
		keyboard,
		restore,
		'upload-file': uploadFile,
		download,
		check
	} as const;

	export type IconName = keyof typeof icons;
</script>

<script lang="ts">
	let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

<span class="icon" style="width:{size}px; height:{size}px;">
	{@html icons[name]}
</span>

<style>
	.icon {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
	}

	.icon :global(svg) {
		width: 100%;
		height: 100%;
		fill: currentColor;
	}
</style>
