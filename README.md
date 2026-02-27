# joonas-query-language

https://joonaslindberg.fi/jql/

My own Web App which makes use of JQL, a database query language I invented.

Currently supported JQL commands are:
* GET - For viewing tables
* ADD - For inserting rows into tables
* NEW TABLE - For creating new tables

Features that are currently yet to be implemented:
* CHANGE - For modifying rows of tables
* REMOVE - For removing rows from tables

# File Format of the "tables.jdb" File

Here is the file format of the "tables.jdb" file, a binary file which holds all of the user created JQL tables.

All the byte, word and doubleword numeric values in the .JDB file are Little Endian (Least Significant Byte First).

WORD = 16-bit value

*         4 BYTES: Size of this table in bytes, including these first 4 bytes.
*         4 BYTES: Current value of the INT_AUTOINCREMENT data type. This is always set to 1 when a new table is created.
*         N BYTES: Null-terminated string. The name of this table.
*         4 BYTES: Number of rows in this table.
*            BYTE: Number of columns in this table.
*         N WORDS: N column data type definitions. N is determined by the previous value "number of columns". The first byte indicates constraint: can be null (0) or cannot be null (1), the second byte indicates the data type of the column.
*       N STRINGS: N null-terminated strings for column names. N is determined by the value in "number of columns".
* N 4-BYTE VALUES: Index of each row (row offset from the very start of the table). N is determined by the value in "number of columns".
* Then comes the data, if the number of rows is greater than zero. If a field starts with a byte of value 0, it means that field is NULL and therefore the next byte belongs to the next field on the table.

Data types:
* 01 INT_AUTOINCREMENT: 4 byte unsigned integer which is automatically incremented by one every time a new entry is added to the table.
* 02 INT: 4 byte (32-bit) integer.
* 03 QUADWORD: 8 byte (64-bit) integer.
* 04 DOUBLE: 9 byte value in which the first byte determines the place of the decimal point.
* 05 TEXT: text string. First 4 bytes indicate length of text, so the text string needn't be null terminated. The text length is needed for queries in which we need to retrieve the length of the text in the requested column.
* 06 DATE: date, in the format YYYY-MM-DD.
