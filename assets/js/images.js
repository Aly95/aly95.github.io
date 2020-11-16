<script>

var imagesProject45 = [images/project45, images/fora];
var x = -1;

function displayNextImage() {
	x = (x ===images.length - 1) ? 0 : x + 1;
	document.getElementById("imgProject").src = imagesProject45[x];
}

function displayPreviousIMage() {
	x = (x <= 0) ? images.length - 1 : x - 1;
	document.getElementById("imgProject").src = imagesProject45[x]
}

function startTimer() {
	setInterval(displayNextImage, 100);
}


</script>
