interface Props {
	path?: string | null;
}

function base64ImageConverter(props: Props) {
	const { path } = props;
	return `data:image/png;base64,${path}`;
}

export default base64ImageConverter;
