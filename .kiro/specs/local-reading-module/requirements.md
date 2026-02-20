# Requirements Document

## Introduction

This document specifies the requirements for a local reading module feature that enables users to import, manage, and read electronic books (EPUB and TXT formats) entirely within their browser. The system operates without any backend services, storing all data locally in IndexedDB, providing a complete offline reading experience with persistent storage, reading progress tracking, and customizable reading preferences.

## Glossary

- **Book**: An electronic document in EPUB or TXT format stored in the local database
- **Bookshelf**: The main interface displaying all imported books in a grid layout
- **Reading_Engine**: The component responsible for parsing and rendering book content
- **CFI**: Canonical Fragment Identifier, a standard for identifying locations in EPUB documents
- **IndexedDB**: Browser-based database for storing structured data locally
- **Virtual_Scrolling**: A rendering technique that only displays visible content for performance
- **Reading_Position**: The last known location where a user stopped reading a book
- **Chapter**: A logical division of book content, auto-detected for TXT files or extracted from EPUB structure

## Requirements

### Requirement 1: Local File Import

**User Story:** As a reader, I want to import EPUB and TXT files from my device, so that I can read them in the application without uploading to any server.

#### Acceptance Criteria

1. WHEN a user drags and drops a file with .epub or .txt extension into the import area, THE Import_Handler SHALL accept the file and begin processing
2. WHEN a user clicks the file selector button, THE Import_Handler SHALL open a native file picker filtered to .epub and .txt files
3. WHEN a valid file is selected, THE Import_Handler SHALL read the file using FileReader.readAsArrayBuffer
4. WHEN file reading completes successfully, THE Storage_Manager SHALL store the binary data in IndexedDB
5. IF a file with unsupported format is provided, THEN THE Import_Handler SHALL reject the file and display an error message
6. WHEN a file is successfully imported, THE Bookshelf SHALL update to display the new book

### Requirement 2: Persistent Book Storage

**User Story:** As a reader, I want my imported books to remain available after closing and reopening the application, so that I don't need to re-import them.

#### Acceptance Criteria

1. WHEN a book is imported, THE Storage_Manager SHALL persist the book data to IndexedDB with metadata including title, author, format, cover, data, and addTime
2. WHEN the application loads, THE Storage_Manager SHALL retrieve all books from IndexedDB
3. WHEN the page is refreshed, THE Bookshelf SHALL display all previously imported books
4. THE Storage_Manager SHALL maintain data integrity across browser sessions

### Requirement 3: Bookshelf Display

**User Story:** As a reader, I want to see all my books displayed with covers and reading progress, so that I can easily browse and select what to read.

#### Acceptance Criteria

1. THE Bookshelf SHALL display books in a responsive grid layout
2. WHEN displaying a book card, THE Bookshelf SHALL show the book cover, title, and reading progress percentage
3. WHEN an EPUB book is imported, THE Metadata_Extractor SHALL extract the cover image from the EPUB file
4. WHEN a TXT book is imported, THE Bookshelf SHALL display a default cover placeholder
5. THE Bookshelf SHALL calculate and display reading progress as a percentage based on saved position

### Requirement 4: Book Deletion

**User Story:** As a reader, I want to delete books from my library, so that I can manage my collection and remove books I no longer need.

#### Acceptance Criteria

1. WHEN a user clicks the delete button on a book card, THE Bookshelf SHALL prompt for confirmation
2. WHEN deletion is confirmed, THE Storage_Manager SHALL remove the book record from the books table
3. WHEN a book is deleted, THE Storage_Manager SHALL remove associated progress records from the progress table
4. WHEN deletion completes, THE Bookshelf SHALL update to remove the deleted book from display

### Requirement 5: EPUB Reading Engine

**User Story:** As a reader, I want to read EPUB books with proper formatting and navigation, so that I can enjoy a quality reading experience.

#### Acceptance Criteria

1. THE EPUB_Reader SHALL use Epub.js library for parsing and rendering EPUB content
2. WHEN an EPUB book is opened, THE EPUB_Reader SHALL render content into a fixed-size DOM container
3. WHEN an EPUB contains a table of contents, THE EPUB_Reader SHALL display it for navigation
4. THE EPUB_Reader SHALL support page turning via next/previous controls
5. WHEN a user navigates to a new location, THE EPUB_Reader SHALL generate a CFI for that position
6. THE EPUB_Reader SHALL support streaming rendering for large EPUB files

### Requirement 6: TXT Parsing and Rendering

**User Story:** As a reader, I want to read TXT files with automatic chapter detection, so that I can navigate long text documents easily.

#### Acceptance Criteria

1. WHEN a TXT file is opened, THE TXT_Parser SHALL load the entire file content
2. THE TXT_Parser SHALL detect chapters using the regex pattern: /第[一二三四五六七八九十百千0-9]+[章回节].*/g
3. WHEN chapters are detected, THE TXT_Reader SHALL create a navigable table of contents
4. THE TXT_Reader SHALL implement virtual scrolling for rendering large text files
5. WHEN a user scrolls, THE TXT_Reader SHALL only render visible content plus a buffer zone

### Requirement 7: Reading Progress Auto-Save

**User Story:** As a reader, I want my reading position to be automatically saved, so that I can resume reading from where I left off.

#### Acceptance Criteria

1. WHEN a user reads a book, THE Progress_Tracker SHALL automatically record the current reading position
2. THE Progress_Tracker SHALL save progress to the progress table with bookId, chapterIndex, position, and updateTime
3. WHEN a user closes a book, THE Progress_Tracker SHALL persist the final reading position
4. WHEN a user opens a previously read book, THE Reading_Engine SHALL automatically navigate to the last saved position
5. THE Progress_Tracker SHALL update progress records without requiring manual user action

### Requirement 8: Reading Preference Settings

**User Story:** As a reader, I want to customize my reading experience with different themes and text sizes, so that I can read comfortably in various conditions.

#### Acceptance Criteria

1. THE Settings_Manager SHALL provide three background color options: white, night mode, and eye-protection mode
2. WHEN a user selects a background color, THE Reading_Engine SHALL apply it to the reading container
3. THE Settings_Manager SHALL provide font size adjustment controls
4. WHEN a user adjusts font size, THE Reading_Engine SHALL update the text rendering accordingly
5. THE Settings_Manager SHALL provide line height adjustment controls
6. WHEN a user adjusts line height, THE Reading_Engine SHALL update the text spacing accordingly
7. THE Settings_Manager SHALL persist user preferences across sessions

### Requirement 9: Offline Operation

**User Story:** As a reader, I want the application to work completely offline, so that I can read without internet connectivity.

#### Acceptance Criteria

1. THE Application SHALL function without any network requests for core reading features
2. THE Application SHALL NOT upload any book data to external servers
3. THE Application SHALL store all data exclusively in browser IndexedDB
4. THE Application SHALL NOT require user authentication or login

### Requirement 10: Database Schema Implementation

**User Story:** As a developer, I want a well-structured database schema using Dexie.js, so that book and progress data is organized and efficiently accessible.

#### Acceptance Criteria

1. THE Database_Manager SHALL create a books table with fields: id (auto-increment), title, author, format, cover, data (ArrayBuffer), addTime
2. THE Database_Manager SHALL create a progress table with fields: bookId, chapterIndex, position, updateTime
3. THE Database_Manager SHALL use Dexie.js as the IndexedDB wrapper
4. THE Database_Manager SHALL establish proper indexes for efficient querying
5. THE Database_Manager SHALL handle database version migrations if schema changes occur

### Requirement 11: Long Text Robustness

**User Story:** As a reader, I want to read extremely long TXT files (millions of characters) without performance degradation, so that I can enjoy smooth scrolling even with large documents.

#### Acceptance Criteria

1. WHEN a ContentLayer text exceeds 15,000 characters, THE Adapter SHALL automatically split it into multiple consecutive ContentLayers
2. WHEN splitting text, THE Adapter SHALL prioritize splitting at newline characters (\n) to avoid breaking sentences
3. IF no newline is found within 500 characters before the threshold, THE Adapter SHALL split at the nearest space character
4. IF no space is found, THE Adapter SHALL split at the hard limit of 15,000 characters
5. WHEN rendering chunked layers, THE Reading_Engine SHALL maintain smooth scrolling performance
6. THE Chunking_Algorithm SHALL apply to both TXT and EPUB formats
7. WHEN an image is associated with chunked text, THE image SHALL only be attached to the first chunk
