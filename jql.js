const jql_datatypes = ["int_autoincrement", "int", "quadword", "double", "text", "date"];

var words_in_user_query = [];

var current_pos_in_user_query;

var db_filesize = 0; // Filesize of the entire "tables.jdb" file with all the tables in it taken into account, if there are any.
var db_table = []; // This contains the actual "tables.jdb" file.

var db_table_pos; // This is 0 in case we add a new table to an empty database.

var number_of_tables = 0; // Number of database tables in our database

var numberOfDataTypes; // Number of columns (data types) for the currently loaded table
var db_table_datatypes = []; // Data types for the currently loaded table
var db_table_datatype_constraints = []; // Data type constraints for the currently loaded table
var db_table_start_of_column_names; // Offset of column names for the currently loaded table
var db_table_start_of_indices; // Offset of record indices for the currently loaded table
var db_table_index_number_of_table_that_was_found; // The findTable() function returns the index number of the table that was found, if it was found.
var db_table_offset_of_table_after_found_table; // The findTable() function returns the offset on db_table of the next table (the one right after the requested table, if the requested table was found).

var memoryBlockOriginalAddress;
var memoryBlockToBeRelocated = [];

function characterBelongingToSequence(char, mode) {
	switch(mode) {
		case 0:
			if(char == " ") {
				return true;
			}
			break;
		case 1:
			if(
				(char >= '0' && char <= '9') ||
				(char >= 'a' && char <= 'z') ||
				(char >= 'A' && char <= 'Z') ||
				char == "_" ||
				char == "-"
			) {
				return true;
			}
			break;
		case 2:
			if(
				(char >= '0' && char <= '9') ||
				(char >= 'a' && char <= 'z') ||
				(char >= 'A' && char <= 'Z') ||
				char == "_" ||
				char == "-" ||
				char == " " ||
				char == '"' ||
				char == "'"
			) {
				return false;
			}
			return true;
			break;
		case 3:
			if(char != '"') {
				return true;
			}
			return false;
			break;
		case 5:
			if(char != "'") {
				return true;
			}
			return false;
			break;
	}
	return false;
}

function whatCharacter(char, mode) {
	if(char == " ") {
		return 0;
	}
	if(
		(char >= '0' && char <= '9') ||
		(char >= 'a' && char <= 'z') ||
		(char >= 'A' && char <= 'Z') ||
		char == "_" ||
		char == "-"
	) {
		return 1;
	}
	if(char == '"') {
		if(mode == 3) {
			return 4;
		}
		return 3;
	}
	if(char == "'") {
		if(mode == 5) {
			return 4;
		}
		return 5;
	}
	return 2;
}

function isWord(word) {
	for(var i = 0; i < word.length; i++) {
		if( !((word[i] >= '0' && word[i] <= '9') || (word[i] >= 'a' && word[i] <= 'z') || (word[i] >= 'A' && word[i] <= 'Z') || word[i] == "_" )) {
			return false;
		}
	}
	return true;
}

function numberOfDataType(word) {
	word = word.toLowerCase();
	for(var i = 0; i < jql_datatypes.length; i++) {
		if(word == jql_datatypes[i]) {
			return i + 1;
		}
	}
	return -1;
}

function findTable(tableName) {
	var dbTablePos = 0;
	var found = false;
	var offset;
	var currentTableBeingChecked = 0;
	db_table_index_number_of_table_that_was_found = 0;
	db_table_offset_of_table_after_found_table = 0;
	while(currentTableBeingChecked < number_of_tables) {
		if(
			db_table[dbTablePos + 0] == undefined ||
			(db_table[dbTablePos + 0] == 0 && db_table[dbTablePos + 1] == 0 && db_table[dbTablePos + 2] == 0 && db_table[dbTablePos + 3] == 0)
		) {
			dbTablePos += getFourByteIntFromGivenOffsetOnCurrentTable(dbTablePos);
			currentTableBeingChecked++;
			db_table_index_number_of_table_that_was_found++;
		}
		else {
			console.log("OFFSET ON DB_TABLE OF FOUND TABLE = " + dbTablePos);
			var checking = true;
			// Table header starts with:
			// 4 BYTES: TABLE SIZE (INCLUDING THESE 4 SIZE BYTES)
			// 4 BYTES: CURRENT VALUE OF INT_AUTOINCREMENT
			var stringPos = dbTablePos + 8;
			offset = 0;
			while(checking) {
				if(db_table[stringPos] == 0) {
					checking = false;
					if(offset != tableName.length) {
						dbTablePos += getFourByteIntFromGivenOffsetOnCurrentTable(dbTablePos);
						currentTableBeingChecked++;
						db_table_index_number_of_table_that_was_found++;
					}
					else {
						found = true;
						currentTableBeingChecked = number_of_tables;
					}
				}
				else if(db_table[stringPos] == tableName.charCodeAt(offset)) {
					stringPos++;
					offset++;
				}
				else {
					checking = false;
					dbTablePos += getFourByteIntFromGivenOffsetOnCurrentTable(dbTablePos);
					currentTableBeingChecked++;
					db_table_index_number_of_table_that_was_found++;
				}
			}
		}
	}
	if(found) {
		// If the requested table was found, then set the data types and their constraints.
		//to get to the data types & constraints:
		//8 + tablename length plus terminating null + 5 (4 row bytes and 1 column byte)
		// or 13 + tablename length plus terminating null
		numberOfDataTypes = db_table[(dbTablePos + 12 + (tableName.length + 1))];
		var posOfDataTypes = dbTablePos + 13 + (tableName.length + 1);
		db_table_start_of_column_names = posOfDataTypes + (numberOfDataTypes * 2);
		db_table_start_of_indices = db_table_start_of_column_names;
		var pointerPos = 0;
		while(pointerPos < numberOfDataTypes) {
			if(db_table[db_table_start_of_indices] == 0) {
				pointerPos++;
			}
			db_table_start_of_indices++;
		}
		console.log("table found, number of datatypes = " + numberOfDataTypes);
		console.log("db_table_start_of_column_names = " + db_table_start_of_column_names);
		console.log("db_table_start_of_indices = " + db_table_start_of_indices);
		db_table_datatypes = [];
		db_table_datatype_constraints = [];
		for(var i = 0; i < numberOfDataTypes; i++) {
			db_table_datatype_constraints[i] = db_table[(posOfDataTypes + (i * 2) + 0)];
			db_table_datatypes[i]            = db_table[(posOfDataTypes + (i * 2) + 1)];
		}
		console.log(db_table_datatype_constraints);
		console.log(db_table_datatypes);
		var howMuchToAddToGetToNextTable = getFourByteIntFromGivenOffsetOnCurrentTable(dbTablePos);
		db_table_offset_of_table_after_found_table = dbTablePos + howMuchToAddToGetToNextTable;
		return dbTablePos;
	}
	return -1;
}

function fourByte(number) {
	var remaining = number;
	var arr4B = [];
	arr4B[3] = Math.floor(number / 16777216);
	remaining -= (arr4B[3] * 16777216);
	arr4B[2] = Math.floor(remaining / 65536);
	remaining -= (arr4B[2] * 65536);
	arr4B[1] = Math.floor(remaining / 256);
	remaining -= (arr4B[1] * 256);
	arr4B[0] = remaining;
	return arr4B;
}

function getFourByteIntFromGivenOffsetOnCurrentTable(givenPos) {
	console.log("VALUE PASSED TO getFourByteIntFromGivenOffsetOnCurrentTable(givenPos) = " + givenPos);
	var numberOfRows = db_table[givenPos + 0] + (db_table[givenPos + 1] * 256) + (db_table[givenPos + 2] * 65536) + (db_table[givenPos + 3] * 16777216);
	return numberOfRows;
}

function fetchColumnData(tableOffset, currentColumn) {
	if(db_table[tableOffset] == 0) {
		tableOffset++;
		return [tableOffset, "<i>NULL</i>"];
	}
	if(db_table_datatypes[currentColumn] == 1 || db_table_datatypes[currentColumn] == 2) {
		var number = db_table[tableOffset + 1] + (db_table[tableOffset + 2] * 256) + (db_table[tableOffset + 3] * 65536) + (db_table[tableOffset + 4] * 16777216);
		tableOffset += 5;
		return [tableOffset, number];
	}
	if(db_table_datatypes[currentColumn] == 5) {
		var text = "";
		var textLength = db_table[tableOffset + 1] + (db_table[tableOffset + 2] * 256) + (db_table[tableOffset + 3] * 65536) + (db_table[tableOffset + 4] * 16777216);
		tableOffset += 5;
		while(textLength > 0) {
			text += String.fromCharCode(db_table[tableOffset]);
			tableOffset++;
			textLength--;
		}
		return [tableOffset, text];
	}
	if(db_table_datatypes[currentColumn] == 6) {
		console.log("date bytes are");
		console.log(db_table[tableOffset + 1]);
		console.log(db_table[tableOffset + 2]);
		console.log(db_table[tableOffset + 3]);
		console.log(db_table[tableOffset + 4]);
		const year = db_table[tableOffset + 1] + (db_table[tableOffset + 2] * 256);
		var month = db_table[tableOffset + 3];
		var day = db_table[tableOffset + 4];
		if(month < 10) month = "0" + month;
		if(day < 10) day = "0" + day;
		tableOffset += 5;
		return [tableOffset, year + "-" + month + "-" + day];
	}
}

function sizeOfSubsequentTables(givenTableIndex) {
	var currentTableIndex = 0;
	var dbPos = 0;
	var totalSizeOfAllRemainingTables = 0;
	while(currentTableIndex < givenTableIndex) {
		var howMuchToAdd = getFourByteIntFromGivenOffsetOnCurrentTable(dbPos);
		dbPos += howMuchToAdd;
		currentTableIndex++;
	}
	while(currentTableIndex < number_of_tables) {
		var howMuchToAdd = getFourByteIntFromGivenOffsetOnCurrentTable(dbPos);
		totalSizeOfAllRemainingTables += howMuchToAdd;
		currentTableIndex++;
	}
	return totalSizeOfAllRemainingTables;
}

// Save the database to the "tables.jdb" file every time that any of the tables is modified.
function saveDatabase() {
	var data = new FormData();
	data.append("data", db_table);
	var xhr = new XMLHttpRequest();
	xhr.open( 'post', 'jqlsave.php', true );
	xhr.send(data);
}

function parse() {
	var currentDbTablePos = 0;
	var sizeofalltherest = 0; // If we have multiple tables (eg. table 0, table 1, table 2 etc.) and we're handling table 0 for example, this holds the total size of the remaining tables 1, 2 etc.
	var originalPosOfTables = 0; // Original offset of table(s) on db_table, in case they need to be relocated.
	console.log("words_in_user_query:");
	console.log(words_in_user_query);

	if(
		words_in_user_query[0].toLowerCase() == "add"
	) {
		var userAddedData = [];
		var userAddedDataPos = 0;
		const tableName = words_in_user_query[1].toLowerCase();
		currentDbTablePos = findTable(tableName);
		if(currentDbTablePos == -1) {
			document.getElementById("response").innerHTML = "No table named \"" + words_in_user_query[1] + "\" found.";
		}
		else {
			var error = false;
			if(words_in_user_query[2] != "(") {
				error = true;
			}
			else {
				memoryBlockToBeRelocated = [];
				db_table_index_number_of_table_that_was_found++;
				console.log("Index number of next table = " + db_table_index_number_of_table_that_was_found);
				var sizeofalltherest = sizeOfSubsequentTables(db_table_index_number_of_table_that_was_found);
				console.log("Total size of all the remaining tables = " + sizeofalltherest);

				// In case there are other tables after the table that's currently being handled, those tables also move whenever the size of the current table changes.
				// The tables are copied to this array from which they can be copied to their new location.
				if(sizeofalltherest > 0) {
					originalPosOfTables = db_table_offset_of_table_after_found_table;
					for(var pos = 0; pos < sizeofalltherest; pos++) {
						memoryBlockToBeRelocated[pos] = db_table[db_table_offset_of_table_after_found_table + pos];
					}
				}

				// Go through the words entered after the opening bracket.
				var currentUserQueryPos = 3;
				while(currentUserQueryPos < words_in_user_query.length && words_in_user_query[currentUserQueryPos] != ";") {
					console.log("words_in_user_query[currentUserQueryPos] = " + words_in_user_query[currentUserQueryPos]);
					if(!isNaN( parseInt(words_in_user_query[currentUserQueryPos]) )) {
						userAddedData[userAddedDataPos] = parseInt(words_in_user_query[currentUserQueryPos]);
						userAddedDataPos++;
						currentUserQueryPos += 2;
					}
					else if(
						(words_in_user_query[currentUserQueryPos][0] == '"' && words_in_user_query[currentUserQueryPos][(words_in_user_query[currentUserQueryPos].length - 1)] == '"') ||
						(words_in_user_query[currentUserQueryPos][0] == "'" && words_in_user_query[currentUserQueryPos][(words_in_user_query[currentUserQueryPos].length - 1)] == "'")
						) {
						userAddedData[userAddedDataPos] = words_in_user_query[currentUserQueryPos];
						userAddedDataPos++;
						currentUserQueryPos += 2;
					}
					else if(words_in_user_query[currentUserQueryPos].toLowerCase() == "null") {
						userAddedData[userAddedDataPos] = "null";
						userAddedDataPos++;
						currentUserQueryPos += 2;
					}
					else {
						error = true;
						currentUserQueryPos = words_in_user_query.length;
					}
				}
			}
			if(error) {
				document.getElementById("response").innerHTML = "Syntax error. Please check the documentation for correct usage of the ADD command.";
			}
			else {

				if(userAddedDataPos != numberOfDataTypes) {
					document.getElementById("response").innerHTML = "Error. The table has " + numberOfDataTypes + " columns, but you have provided " + userAddedDataPos + " columns in the query.";
				}



				else {

				var sizeOfCurrentlyHandledTable = getFourByteIntFromGivenOffsetOnCurrentTable(currentDbTablePos);
				console.log("TABLE SIZE PRIOR TO ADDING ENTRY: " + sizeOfCurrentlyHandledTable);

				// How much to add to the table size. (The first 4 bytes of the table.)
				var howMuchToAddToTableSize = 0;

				// Remember that all NON-NULL data takes at least one byte: the 1st byte is a non-zero byte, indicating that this column is not null.

				// The very first row of the table is always at a specific offset.
				var startofnewrecord4b = fourByte((db_table_start_of_indices - currentDbTablePos)); // Don't add 4 to this one, because the 4 is added by the code which updates the index locations at the end.
				var posOfNewRecord = db_table_start_of_indices + 4;


				var rows = getFourByteIntFromGivenOffsetOnCurrentTable(currentDbTablePos + 8 + tableName.length + 1);

				if(rows > 0) {
					// When a new row is added, all data starting after the indices is moved forward by 4 bytes.
					console.log("ADDING ROW TO TABLE WITH MORE THAN 0 ROWS. db_table_start_of_indices = " + db_table_start_of_indices);
					console.log("currentDbTablePos = " + currentDbTablePos);

					var tableSize = getFourByteIntFromGivenOffsetOnCurrentTable(currentDbTablePos);
					var memBlockStart = db_table_start_of_indices + (4 * rows);
					var howMuchToAddToGetMemBlockEndAddress = currentDbTablePos + tableSize - memBlockStart;
					var memBlockEnd = memBlockStart + howMuchToAddToGetMemBlockEndAddress;
					var memBlockSize = memBlockEnd - memBlockStart;

					console.log("memBlockSize = " + memBlockSize);

					memBlockEnd += 3;

					posOfNewRecord = memBlockEnd + 1;
					//startofnewrecord4b = fourByte((posOfNewRecord - 4));
					startofnewrecord4b = fourByte((posOfNewRecord - currentDbTablePos));

					memBlockStart = currentDbTablePos + tableSize - 1;
					console.log("memBlockStart = " + memBlockStart);
					console.log("memBlockEnd = " + memBlockEnd);
					while(memBlockSize > 0) {
						db_table[memBlockEnd] = db_table[memBlockStart];
						memBlockEnd--;
						memBlockStart--;
						memBlockSize--;
					}
				}

				var numericvalue = startofnewrecord4b[0] + (startofnewrecord4b[1] * 256) + (startofnewrecord4b[2] * 65536) + (startofnewrecord4b[3] * 16777216);
				console.log("Start pos of new record, value is relative to start of current table = " + numericvalue);


				console.log("WRITING INDEX VALUE TO INDEX. db_table_start_of_indices = " + db_table_start_of_indices + " AND posOfNewRecord = " + posOfNewRecord);
				db_table[db_table_start_of_indices + (4 * rows) + 0] = startofnewrecord4b[0];
				db_table[db_table_start_of_indices + (4 * rows) + 1] = startofnewrecord4b[1];
				db_table[db_table_start_of_indices + (4 * rows) + 2] = startofnewrecord4b[2];
				db_table[db_table_start_of_indices + (4 * rows) + 3] = startofnewrecord4b[3];


				for(var i = 0; i < numberOfDataTypes; i++) {
					if(userAddedData[i] == "null") {
						howMuchToAddToTableSize++;
						db_table[posOfNewRecord] = 0;
						posOfNewRecord++;
					}
					else {
						var fourByteInteger = userAddedData[i];
						console.log("datatype " + i + " = " + jql_datatypes[(db_table_datatypes[i] - 1)]);
						var typeOfDataToHandle = db_table_datatypes[i];
						if(typeOfDataToHandle == 1) {
							// In case of INT_AUTOINCREMENT, we take the current value of that variable, which is stored at the start of the table, right after the 4 size bytes.
							fourByteInteger = db_table[currentDbTablePos + 4] + (db_table[currentDbTablePos + 5] * 256) + (db_table[currentDbTablePos + 6] * 65536) + (db_table[currentDbTablePos + 7] * 16777216);

							// Increment the INT_AUTOINCREMENT by one and store the current value to the table.
							var increasedByOne = fourByte((fourByteInteger + 1));
							db_table[currentDbTablePos + 4] = increasedByOne[0];
							db_table[currentDbTablePos + 5] = increasedByOne[1];
							db_table[currentDbTablePos + 6] = increasedByOne[2];
							db_table[currentDbTablePos + 7] = increasedByOne[3];
						}
						if(typeOfDataToHandle == 2) typeOfDataToHandle = 1;
						switch(typeOfDataToHandle) {
							case 1:
								howMuchToAddToTableSize += 5;
								var fourbyte = fourByte(fourByteInteger);
								console.log("fourbyte = " + fourbyte);
								db_table[posOfNewRecord] = 1;
								posOfNewRecord++;
								db_table[posOfNewRecord] = fourbyte[0];
								posOfNewRecord++;
								db_table[posOfNewRecord] = fourbyte[1];
								posOfNewRecord++;
								db_table[posOfNewRecord] = fourbyte[2];
								posOfNewRecord++;
								db_table[posOfNewRecord] = fourbyte[3];
								posOfNewRecord++;
								break;
							case 5:
								var lengthOfText = userAddedData[i].length - 2;
								console.log("lengthOfText = " + lengthOfText);
								howMuchToAddToTableSize += 5 + lengthOfText;
								db_table[posOfNewRecord] = 1;
								posOfNewRecord++;
								var fourbyte = fourByte(lengthOfText);
								console.log("fourbyte = " + fourbyte);
								db_table[posOfNewRecord] = fourbyte[0];
								posOfNewRecord++;
								db_table[posOfNewRecord] = fourbyte[1];
								posOfNewRecord++;
								db_table[posOfNewRecord] = fourbyte[2];
								posOfNewRecord++;
								db_table[posOfNewRecord] = fourbyte[3];
								posOfNewRecord++;
								for(var pos = 1; pos < (userAddedData[i].length - 1); pos++) {
									db_table[posOfNewRecord] = userAddedData[i].charCodeAt(pos);
									posOfNewRecord++;
								}
								break;
							case 6:
								howMuchToAddToTableSize += 5;
								console.log("date type. date = " + userAddedData[i]);
								var year = parseInt(userAddedData[i].substring(1, 5));
								var month = parseInt(userAddedData[i].substring(6, 8));
								var day = parseInt(userAddedData[i].substring(9, 11));
								console.log("year:");
								console.log(year);
								console.log("month:");
								console.log(month);
								console.log("day:");
								console.log(day);
								var twobyte = fourByte(year);
								console.log("year bytes:");
								console.log(twobyte[0] + ", " + twobyte[1]);

								db_table[posOfNewRecord] = 1;
								posOfNewRecord++;
								db_table[posOfNewRecord] = twobyte[0];
								posOfNewRecord++;
								db_table[posOfNewRecord] = twobyte[1];
								posOfNewRecord++;
								db_table[posOfNewRecord] = month;
								posOfNewRecord++;
								db_table[posOfNewRecord] = day;
								posOfNewRecord++;

								break;
						}
					}
				}
				console.log("currentDbTablePos = " + currentDbTablePos);

				// New row added. Update all the relevant header information of the table.

				console.log("SIZE OF ADDED NEW RECORD IN BYTES: " + howMuchToAddToTableSize);

				var tableSize = getFourByteIntFromGivenOffsetOnCurrentTable(currentDbTablePos);

				howMuchToAddToTableSize += 4; // Always remember to also add the size of the index pointer to the table size, which is always 4 bytes.

				tableSize += howMuchToAddToTableSize;
				var fourbyte = fourByte(tableSize);

				// Update the size of the table.
				db_table[currentDbTablePos + 0] = fourbyte[0];
				db_table[currentDbTablePos + 1] = fourbyte[1];
				db_table[currentDbTablePos + 2] = fourbyte[2];
				db_table[currentDbTablePos + 3] = fourbyte[3];
				var rows = getFourByteIntFromGivenOffsetOnCurrentTable(currentDbTablePos + 8 + tableName.length + 1);
				rows++;
				console.log("rows = " + rows);

				// When resizing the table, the locations of all records have moved further by 4. So we increment all indices by 4.
				for(var i = 0; i < rows; i++) {
					var val = getFourByteIntFromGivenOffsetOnCurrentTable((db_table_start_of_indices + (4 * i) + 0));
					val += 4;
					var val4b = fourByte(val);
					db_table[(db_table_start_of_indices + (4 * i) + 0)] = val4b[0];
					db_table[(db_table_start_of_indices + (4 * i) + 1)] = val4b[1];
					db_table[(db_table_start_of_indices + (4 * i) + 2)] = val4b[2];
					db_table[(db_table_start_of_indices + (4 * i) + 3)] = val4b[3];
					console.log("INDEX NOW FOR ROW " + i + " = " + val);
				}

				fourbyte = fourByte(rows);
				// Update the number of rows of the table.
				db_table[currentDbTablePos + 8 + tableName.length + 1 + 0] = fourbyte[0];
				db_table[currentDbTablePos + 8 + tableName.length + 1 + 1] = fourbyte[1];
				db_table[currentDbTablePos + 8 + tableName.length + 1 + 2] = fourbyte[2];
				db_table[currentDbTablePos + 8 + tableName.length + 1 + 3] = fourbyte[3];
				console.log("userAddedData:");
				console.log(userAddedData);
				document.getElementById("response").innerHTML = "New row added to table successfully.";

				if(sizeofalltherest > 0) {
					console.log("memoryBlockToBeRelocated size:");
					console.log(memoryBlockToBeRelocated.length);
					console.log("originalPosOfTables = " + originalPosOfTables);
					console.log("size added to current table = " + howMuchToAddToTableSize);
					originalPosOfTables += howMuchToAddToTableSize;
					console.log("originalPosOfTables after relocation = " + originalPosOfTables);
					for(var i = 0; i < memoryBlockToBeRelocated.length; i++) {
						db_table[originalPosOfTables + i] = memoryBlockToBeRelocated[i];
					}
					console.log("db_table now:");
					console.log(db_table);
				}
				saveDatabase();
				}
			}
		}
	}
	else if(
		words_in_user_query[0].toLowerCase() == "debug"
	) {
		console.log("*** DEBUG INFO ***");
		var pos = findTable("products");
		if(pos != -1) console.log("products found");
		pos = findTable("weird");
		if(pos != -1) {
			console.log("*** weird found, INFORMATION ABOUT IT FOLLOWS ***");
			var size = getFourByteIntFromGivenOffsetOnCurrentTable(pos);
			console.log("OFFSET ON DB_TABLE = " + pos);
			console.log("TABLE SIZE = " + size);
			var intautoinc = getFourByteIntFromGivenOffsetOnCurrentTable(pos + 4);
			console.log("VALUE OF INT_AUTOINC = " + intautoinc);
			var nameOfTable = "";
			nameOfTable += String.fromCharCode(db_table[pos + 8]);
			nameOfTable += String.fromCharCode(db_table[pos + 9]);
			nameOfTable += String.fromCharCode(db_table[pos + 10]);
			nameOfTable += String.fromCharCode(db_table[pos + 11]);
			nameOfTable += String.fromCharCode(db_table[pos + 12]);
			console.log("NAME RETRIEVED = " + nameOfTable);
			var rows = getFourByteIntFromGivenOffsetOnCurrentTable(pos + 14);
			console.log("ROWS = " + rows);
			var cols = db_table[pos + 18];
			console.log("COLUMNS = " + cols);
			var nameOfCol1 = "";
			var nameOfCol2 = "";
			var nameOfCol3 = "";
			var nameOfCol4 = "";
			nameOfCol1 += String.fromCharCode(db_table[pos + 27]);
			nameOfCol1 += String.fromCharCode(db_table[pos + 28]);

			nameOfCol2 += String.fromCharCode(db_table[pos + 30]);
			nameOfCol2 += String.fromCharCode(db_table[pos + 31]);
			nameOfCol2 += String.fromCharCode(db_table[pos + 32]);
			nameOfCol2 += String.fromCharCode(db_table[pos + 33]);

			nameOfCol3 += String.fromCharCode(db_table[pos + 35]);
			nameOfCol3 += String.fromCharCode(db_table[pos + 36]);
			nameOfCol3 += String.fromCharCode(db_table[pos + 37]);
			nameOfCol3 += String.fromCharCode(db_table[pos + 38]);

			nameOfCol4 += String.fromCharCode(db_table[pos + 40]);
			nameOfCol4 += String.fromCharCode(db_table[pos + 41]);
			nameOfCol4 += String.fromCharCode(db_table[pos + 42]);

			console.log("NAME OF COLUMN1 = " + nameOfCol1);
			console.log("NAME OF COLUMN2 = " + nameOfCol2);
			console.log("NAME OF COLUMN3 = " + nameOfCol3);
			console.log("NAME OF COLUMN4 = " + nameOfCol4);

			var index = getFourByteIntFromGivenOffsetOnCurrentTable(pos + 44);
			console.log("INDEX OF ROW 1 (OFFSET TO ROW 1) = " + index);
			console.log("ADD ONE TO INDEX BECAUSE 1ST BYTE OF EVERY DATATYPE IS ALWAYS NULL INDICATOR.");
			index++;

			var idValue = getFourByteIntFromGivenOffsetOnCurrentTable(index);
			console.log("COLUMN ID = " + idValue);

			console.log("db_table array:");
			console.log(db_table);
		}
	}
	else if(
		words_in_user_query[0].toLowerCase() == "deleteall"
	) {
		db_table = [];
		number_of_tables = 0;
		document.getElementById("response").innerHTML = "All tables removed from database.";
		saveDatabase();
	}
	else if(
		words_in_user_query[0].toLowerCase() == "get"
	) {

		if(words_in_user_query.length > 2 && words_in_user_query[1].toLowerCase() == "all") {
			const tableName = words_in_user_query[2].toLowerCase();
			console.log("name of table to search = " + tableName);


			currentDbTablePos = findTable(tableName);
			if(currentDbTablePos == -1) {
				document.getElementById("response").innerHTML = "No table named \"" + words_in_user_query[2] + "\" found.";
			}
			else {
				var baseAddress = currentDbTablePos;
				console.log("GET: BASE ADDRESS OF CURRENT TABLE = " + baseAddress);
				var sizeofcurrenttable = getFourByteIntFromGivenOffsetOnCurrentTable(currentDbTablePos);
				console.log("SIZE OF REQUESTED TABLE = " + sizeofcurrenttable);
				currentDbTablePos += 8 + tableName.length + 1;
				var rows = getFourByteIntFromGivenOffsetOnCurrentTable(currentDbTablePos);
				console.log(rows + " rows");
				currentDbTablePos += 4;
				var columns = db_table[currentDbTablePos];
				console.log(columns + " columns");
				currentDbTablePos += (columns * 2) + 1;
				var arrayOfColumns = [];
				var arrayOfColumnsPos = 0;
				var columnName = "";
				console.log("char at start = " + db_table[currentDbTablePos]);
				while(arrayOfColumnsPos < columns) {
					if(db_table[currentDbTablePos] == 0) {
						arrayOfColumns[arrayOfColumnsPos] = columnName;
						arrayOfColumnsPos++;
						columnName = "";
					}
					else {
						columnName += String.fromCharCode(db_table[currentDbTablePos]);
					}
					currentDbTablePos++;
				}
				console.log(arrayOfColumns[0]);
				var returnedContent = "";
				if(rows == 1) {
					returnedContent += rows + " row returned.";
				}
				else {
					returnedContent += rows + " rows returned.";
				}
				returnedContent += "<br/><table><tr>";
				for(var i = 0; i < arrayOfColumnsPos; i++) {
					returnedContent += "<th>" + arrayOfColumns[i] + "</th>";
				}
				returnedContent += "</tr>";
				console.log("db_table[currentDbTablePos]:");
				console.log(db_table[currentDbTablePos]);
				var offsetInIndex = db_table[currentDbTablePos + 0] + (db_table[currentDbTablePos + 1] * 256) + (db_table[currentDbTablePos + 2] * 65536) + (db_table[currentDbTablePos + 3] * 16777216);
				var nextOffset = baseAddress + offsetInIndex;
				console.log("nextOffset = " + nextOffset);
				console.log("db_table[nextOffset] and some subsequent bytes:");
				console.log(db_table[nextOffset + 0]); // date not null
				console.log(db_table[nextOffset + 1]); // date least significant byte
				console.log(db_table[nextOffset + 2]);
				console.log(db_table[nextOffset + 3]);
				console.log(db_table[nextOffset + 4]);
				console.log(db_table[nextOffset + 5]); // text not null
				console.log(db_table[nextOffset + 6]); // text length least significant byte
				console.log(db_table[nextOffset + 7]);
				console.log(db_table[nextOffset + 8]);
				console.log(db_table[nextOffset + 9]);
				console.log(db_table[nextOffset + 10]);
				var rowsLeft = rows;
				while(rowsLeft > 0) {
					returnedContent += "<tr>";
					for(var currentColumn = 0; currentColumn < columns; currentColumn++) {
						var nextValues = fetchColumnData(nextOffset, currentColumn);
						nextOffset = nextValues[0];
						returnedContent += "<td>" + nextValues[1] + "</td>";
					}
					returnedContent += "</tr>";
					rowsLeft--;
				}
				returnedContent += "</table>";
				document.getElementById("response").innerHTML = returnedContent;
			}
		}
		else if(words_in_user_query.length == 1) {
			if(number_of_tables == 0) {
				document.getElementById("response").innerHTML = "No tables in this database.";
			}
			else {
				var response;
				if(number_of_tables == 1) {
					response = number_of_tables + " table in the database:";
				}
				else {
					response = number_of_tables + " tables in the database:";
				}
				response += "<br/><ul>";
				var currentTable = 0;
				var dbPos = 0;
				while(currentTable < number_of_tables) {
					var tableName = "";
					for(var stringPos = dbPos + 8; db_table[stringPos] != 0; stringPos++) {
						tableName += String.fromCharCode(db_table[stringPos]);
					}
					response += "<li>" + tableName + "</li>";
					var tSize = getFourByteIntFromGivenOffsetOnCurrentTable(dbPos);
					dbPos += tSize;
					currentTable++;
				}
				response += "</ul>";
				document.getElementById("response").innerHTML = response;
			}
		}
		else {
			document.getElementById("response").innerHTML = "Syntax error. Please check the documentation for correct usage of the GET command.";
		}
	}
	else if(
		words_in_user_query[0].toLowerCase() == "new" &&
		words_in_user_query[1].toLowerCase() == "table"
	) {

		var tableName = words_in_user_query[2].toLowerCase();
		db_table_pos = findTable(tableName);
		if(db_table_pos != -1) {
			document.getElementById("response").innerHTML = "Cannot create \"" + words_in_user_query[2] + "\". Table already exists.";
		}
		else {
			db_table_pos = 0;
			if(number_of_tables > 0) {
				var currTable = 0;
				while(currTable < number_of_tables) {
					var tSize = getFourByteIntFromGivenOffsetOnCurrentTable(db_table_pos);
					db_table_pos += tSize;
					currTable++;
				}
			}
			var tableSize = 13; // Table always has 4 size bytes (which are always accounted for in the table size) + 4 bytes: current value of INT_AUTOINCREMENT + 4 bytes: how many rows + 1 byte: how many columns
			console.log("table name = " + tableName);
			tableSize += tableName.length + 1; // Add length of table name to table size
			var error = false;
			var pos = 3;
			var dataTypePos = 0;
			var dataTypeNames = [];
			var dataTypeTypes = [];
			var dataTypeConstraints = [];
			//console.log("words_in_user_query.length = " + words_in_user_query.length);
			while(pos < words_in_user_query.length) {
				console.log("word in pos " + pos + " = " + words_in_user_query[pos]);
				tableSize += words_in_user_query[pos].length + 1; // Add length of column name to table size
				tableSize += 2; // Add "null / not null" constraint + data type to table size
				dataTypeNames[dataTypePos] = words_in_user_query[pos];
				var whichDataType = numberOfDataType(words_in_user_query[pos + 2]);
				if(words_in_user_query[pos + 1] != "=") {
					error = true;
					document.getElementById("response").innerHTML = "Syntax error near \"" + words_in_user_query[pos + 1] + "\": '=' character expected.";
					pos = words_in_user_query.length;
				}
				else if(whichDataType == -1) {
					error = true;
					document.getElementById("response").innerHTML = "Syntax error near \"" + words_in_user_query[pos + 2] + "\": valid JQL data type expected.";
					pos = words_in_user_query.length;
				}
				else {
					dataTypeTypes[dataTypePos] = whichDataType;
					dataTypeConstraints[dataTypePos] = 0;
					if(words_in_user_query[pos + 3].toLowerCase() == "notnull") {
						dataTypeConstraints[dataTypePos] = 1;
						pos += 5;
					}
					else if(words_in_user_query[pos + 3] == ",") {
						pos += 4;
					}
					else {
						pos = words_in_user_query.length;
					}
					dataTypePos++;
				}
				console.log("POS NOW = " + pos);
			}
			if(!error) {
				console.log("TABLE SIZE = " + tableSize);
				console.log("dataTypeNames:");
				console.log(dataTypeNames);
				console.log("dataTypeTypes:");
				console.log(dataTypeTypes);
				console.log("dataTypeConstraints:");
				console.log(dataTypeConstraints);

				// Write table size to table header.
				db_table[db_table_pos + 0] = tableSize;
				db_table[db_table_pos + 1] = 0;
				db_table[db_table_pos + 2] = 0;
				db_table[db_table_pos + 3] = 0;

				// Write value of INT_AUTOINCREMENT (which starts at 1) to table header.
				db_table[db_table_pos + 4] = 1;
				db_table[db_table_pos + 5] = 0;
				db_table[db_table_pos + 6] = 0;
				db_table[db_table_pos + 7] = 0;

				var tPos = 0;
				for(tPos = tPos; tPos < tableName.length; tPos++) {
					db_table[db_table_pos + 8 + tPos] = tableName.charCodeAt(tPos);
				}
				db_table[db_table_pos + 8 + tPos] = 0;

				tPos++;
				db_table[db_table_pos + 8 + tPos] = 0; // 0 rows
				tPos++;
				db_table[db_table_pos + 8 + tPos] = 0; // 0 rows
				tPos++;
				db_table[db_table_pos + 8 + tPos] = 0; // 0 rows
				tPos++;
				db_table[db_table_pos + 8 + tPos] = 0; // 0 rows

				tPos++;
				db_table[db_table_pos + 8 + tPos] = dataTypeNames.length; // N columns

				tPos++;

				for(var i = 0; i < dataTypeNames.length; i++) {
					db_table[db_table_pos + 8 + tPos] = dataTypeConstraints[i]; // datatype null or not null?
					tPos++;
					db_table[db_table_pos + 8 + tPos] = dataTypeTypes[i]; // datatype
					tPos++;
				}

				for(var i = 0; i < dataTypeNames.length; i++) {
					for(var subPos = 0; subPos < dataTypeNames[i].length; subPos++) {
						db_table[db_table_pos + 8 + tPos] = dataTypeNames[i].charCodeAt(subPos); // insert name of column to table
						tPos++;
					}
					db_table[db_table_pos + 8 + tPos] = 0; // terminating null
					tPos++;
				}


				console.log("db_table.length = " + db_table.length);
				console.log(db_table);

				number_of_tables++;

				document.getElementById("response").innerHTML = "Query executed.";
				console.log("*** START POS OF NEW TABLE " + db_table_pos + " ***");
				console.log("*** ADDED TABLE OF SIZE " + tableSize + " ***");

				saveDatabase();
			}
		}

	}
	else {
		document.getElementById("response").innerHTML = 'Unknown command(s). Please see the <a href="jqldocumentation.html" target="_blank">JQL documentation</a> for information on how to query the JQL database.';
	}
}

// Load the "tables.jdb" file which stores all our tables.
window.onload = function() {
	var jql_table_to_load = fetch("tables.jdb", {
		// Adding Get request
		method: "GET",
		// Setting headers
		headers: {
			'Content-Type': 'application/octet-stream',
		},
		// Setting response type to arraybuffer 
		responseType: "arraybuffer"
	})

	// Handling the received binary data
	.then(response =>{
		if (response.ok){
			return response.arrayBuffer();
		}
		console.log("tables.jdb loaded.");
	})
	.then(arraybuffer => {
		console.log("Status ok.");
		var loaded_jql_table = new Uint8Array(arraybuffer);

		// Move data to our main buffer.
		for(var pos = 0; pos < loaded_jql_table.length; pos++) {
			db_table[pos] = loaded_jql_table[pos];
		}

		// Get the number of tables from the loaded data.
		var fetching = true;
		var pos = 0;
		while(fetching) {
			if(
				db_table[pos + 0] == undefined ||
				(db_table[pos + 0] == 0 && db_table[pos + 1] == 0 && db_table[pos + 2] == 0 && db_table[pos + 3] == 0)
			) {
				fetching = false;
			}
			else {
				number_of_tables++;
				var howMuchToAdd = getFourByteIntFromGivenOffsetOnCurrentTable(pos);
				pos += howMuchToAdd;
			}
		}
	})
	// Handling the error
	.catch(err=>{
		console.log("Found error:", err)
	});
}

function executeQuery() {
	const query = document.getElementById("query").value.trim();

	// Go through every word in the query.
	var word = "";
	var pos = 0;
	words_in_user_query = [];
	current_pos_in_user_query = 0;
	var mode = 1; // 0 = NOT IN A CHARACTER  1 = ALPHANUMERIC CHARACTERS  2 = NON-ALPHANUMERIC CHARACTERS  3 = ENTER QUOTATION MARKS  4 = EXIT QUOTATION MARKS  5 = ENTER ' CHARACTER
	while(pos < query.length + 1) {
		if(pos < query.length && characterBelongingToSequence(query[pos], mode)) {
			if(mode != 0) {
				word += query[pos];
			}
			pos++;
		}
		else {
			if(mode == 3) {
				word += '"';
			}
			if(mode == 5) {
				word += "'";
			}
			if(word != "") {
				words_in_user_query[current_pos_in_user_query] = word;
				current_pos_in_user_query++;
			}
			word = "";
			if(pos == query.length) {
				pos = query.length + 1;
			}
			else {
				mode = whatCharacter(query[pos], mode);
				if(mode == 3) {
					word += '"';
					pos++;
				}
				if(mode == 4) {
					mode = 0;
					pos++;
				}
				if(mode == 5) {
					word += "'";
					pos++;
				}
			}
		}
	}

	// Parse the entered query.
	parse();
}
