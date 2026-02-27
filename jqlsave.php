<?php

if(!empty($_POST['data'])){

header("Access-Control-Allow-Origin: *");

$datastring = $_POST['data'];

$data = explode(",", $datastring);

$fname = "tables.jdb";

// Here's an example which creates a saveable binary from an array.
$datatosave = '';
foreach ($data as $chr) {
	$datatosave .= pack('C', $chr); // First argument 'C': Make each item in the array an unsigned character.
}

$file = fopen($fname, 'wb');//creates new file
//fwrite($file, $data);
fwrite($file, $datatosave);
fclose($file);
}

?>