# Implementation Plan: Local Reading Module

## Overview

This implementation plan breaks down the local reading module into incremental coding tasks. The approach follows a bottom-up strategy: database layer → business logic → UI components → reading engines → integration. Each task builds on previous work and includes testing sub-tasks to validate functionality early.

## Tasks

- [x] 1. Set up database layer with Dexie.js
  - Create `src/db/index.ts` with database schema definition
  - Define Book and Progress interfaces matching the design
  - Configure Dexie database with books and progress tables
  - Set up proper indexes for efficient querying
  - _Requirements: 10.1, 10.2, 10.4_

- [x] 1.1 Write unit tests for database schema
  - Test database initialization
  - Test table creation with correct fields
  - _Requirements: 10.1, 10.2_

- [ ] 2. Implement useLibrary composable
  - [x] 2.1 Create `src/composables/useLibrary.ts` with core book management functions
    - Implement loadBooks() to retrieve all books from IndexedDB
    - Implement getBook() to retrieve a single book by ID
    - _Requirements: 2.2, 2.3_

  - [x] 2.2 Implement book import functionality
    - Implement importBook() with file validation
    - Add FileReader.readAsArrayBuffer for file reading
    - Handle EPUB metadata extraction using Epub.js
    - Extract cover as Blob (not Base64) for efficiency
    - Store book data in IndexedDB with all required fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.3_

  - [x] 2.3 Implement book deletion functionality
    - Implement deleteBook() to remove book from database
    - Ensure cascading deletion of associated progress records
    - _Requirements: 4.2, 4.3_

  - [x] 2.4 Write property test for import-storage-retrieval round trip
    - **Property 1: Import-Storage-Retrieval Round Trip**
    - **Validates: Requirements 1.4, 2.1, 2.2, 2.3**

  - [x] 2.5 Write property test for invalid file rejection
    - **Property 2: Invalid File Rejection**
    - **Validates: Requirements 1.5**

  - [x] 2.6 Write property test for cascading deletion
    - **Property 7: Cascading Deletion**
    - **Validates: Requirements 4.2, 4.3**

- [ ] 3. Implement useProgress composable
  - [x] 3.1 Create `src/composables/useProgress.ts` with progress tracking functions
    - Implement loadProgress() to retrieve progress for a book
    - Implement saveProgress() to store reading position
    - Implement getProgressPercentage() to calculate progress
    - _Requirements: 7.1, 7.2, 3.5_

  - [x] 3.2 Write property test for progress auto-save round trip
    - **Property 12: Progress Auto-Save Round Trip**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [x] 3.3 Write property test for progress percentage calculation
    - **Property 6: Progress Percentage Calculation**
    - **Validates: Requirements 3.5**

- [ ] 4. Implement usePreferences composable
  - [x] 4.1 Create `src/composables/usePreferences.ts` with reading preferences management
    - Implement preferences reactive state
    - Implement setBackgroundColor(), setFontSize(), setLineHeight()
    - Implement getBackgroundColorStyle() for CSS generation
    - Implement loadPreferences() and savePreferences() using localStorage
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 4.2 Write property test for preferences application
    - **Property 13: Reading Preferences Application**
    - **Validates: Requirements 8.2, 8.4, 8.6**

  - [x] 4.3 Write property test for preferences persistence round trip
    - **Property 14: Preferences Persistence Round Trip**
    - **Validates: Requirements 8.7**

- [x] 5. Checkpoint - Ensure all composable tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Bookshelf view component
  - [x] 6.1 Create `src/views/Bookshelf.vue` with book grid display
    - Implement drag-and-drop import area
    - Implement file selector button with .epub/.txt filter
    - Display books in responsive grid layout
    - Render book cards with cover (using URL.createObjectURL for Blobs), title, author, progress
    - Implement delete button with confirmation dialog
    - Handle cover URL cleanup to prevent memory leaks
    - _Requirements: 1.1, 1.2, 1.6, 3.1, 3.2, 3.4, 4.1, 4.4_

  - [x] 6.2 Write property test for book list length invariant
    - **Property 3: Book List Length Invariant**
    - **Validates: Requirements 1.6, 4.4**

  - [x] 6.3 Write property test for book card display completeness
    - **Property 4: Book Card Display Completeness**
    - **Validates: Requirements 3.2**

  - [x] 6.4 Write unit tests for Bookshelf component
    - Test drag-and-drop file handling
    - Test file selector interaction
    - Test delete confirmation flow
    - _Requirements: 1.1, 1.2, 4.1_

- [ ] 7. Implement EPUB Reader component
  - [x] 7.1 Create `src/components/EpubReader.vue` with Epub.js integration
    - Initialize Epub.js book instance from ArrayBuffer
    - Render book content into fixed-size container
    - Extract and display table of contents
    - Implement next/previous page navigation
    - Track CFI position changes
    - Apply reading preferences (background, font size, line height)
    - Auto-save progress on location changes
    - Auto-restore last reading position on open
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.3, 7.4, 8.2, 8.4, 8.6_

  - [x] 7.2 Write property test for EPUB TOC extraction
    - **Property 8: EPUB Table of Contents Extraction**
    - **Validates: Requirements 5.3**

  - [x] 7.3 Write property test for EPUB navigation state changes
    - **Property 9: EPUB Navigation State Changes**
    - **Validates: Requirements 5.4, 5.5**

  - [x] 7.4 Write unit tests for EPUB Reader
    - Test reader initialization with sample EPUB
    - Test navigation controls
    - Test TOC display and navigation
    - _Requirements: 5.2, 5.3, 5.4_

- [ ] 8. Implement TXT Reader component
  - [x] 8.1 Create `src/components/TxtReader.vue` with virtual scrolling
    - Implement multi-encoding detection (UTF-8 → GBK → fallback)
    - Parse text content and split into lines
    - Detect chapters using regex pattern: /第[一二三四五六七八九十百千0-9]+[章回节].*/g
    - Build table of contents from detected chapters
    - Implement virtual scrolling with buffer zone
    - Implement chapter navigation controls
    - Apply reading preferences (background, font size, line height)
    - Auto-save scroll position as progress
    - Auto-restore last scroll position on open
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 7.3, 7.4, 8.2, 8.4, 8.6_

  - [x] 8.2 Write property test for TXT chapter detection
    - **Property 10: TXT Chapter Detection**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 8.3 Write property test for virtual scrolling visibility
    - **Property 11: Virtual Scrolling Visibility**
    - **Validates: Requirements 6.5**

  - [x] 8.4 Write unit tests for TXT Reader
    - Test encoding detection with UTF-8 and GBK files
    - Test chapter detection with various patterns
    - Test virtual scrolling rendering
    - Test edge case: file with no chapters
    - _Requirements: 6.1, 6.2, 6.5_

- [ ] 9. Create Reader view with format routing
  - [x] 9.1 Create `src/views/Reader.vue` as container for reading engines
    - Accept bookId as route parameter
    - Load book data from database
    - Route to EpubReader or TxtReader based on book format
    - Implement settings panel for reading preferences
    - Implement back-to-bookshelf navigation
    - _Requirements: 5.1, 6.1, 8.1, 8.3, 8.5_

  - [x] 9.2 Write integration tests for Reader view
    - Test format-based routing
    - Test settings panel integration
    - _Requirements: 5.1, 6.1, 8.1_

- [ ] 10. Set up routing and integrate components
  - [x] 10.1 Configure Vue Router in `src/router/index.ts`
    - Add route for Bookshelf view (/)
    - Add route for Reader view (/reader/:bookId)
    - Set Bookshelf as default route
    - _Requirements: All_

  - [x] 10.2 Update `src/main.js` to register dependencies
    - Import and register Element Plus
    - Import and register Vue Router
    - Import global styles
    - _Requirements: All_

  - [x] 10.3 Update `src/App.vue` as root component
    - Add router-view for component rendering
    - Remove placeholder content
    - _Requirements: All_

- [ ] 11. Add error handling and loading states
  - [x] 11.1 Enhance composables with error handling
    - Add try-catch blocks for database operations
    - Add error handling for file reading failures
    - Add error handling for EPUB parsing errors
    - Add error handling for storage quota exceeded
    - Display user-friendly error messages using Element Plus
    - _Requirements: All error handling requirements_

  - [x] 11.2 Add loading indicators
    - Add loading state to book import
    - Add loading state to bookshelf loading
    - Add loading state to reader initialization
    - Show progress for large file operations (>50MB)
    - _Requirements: 1.4, 2.2, 5.2, 6.1_

- [x] 12. Write property test for offline operation
  - **Property 15: Offline Operation**
  - **Validates: Requirements 9.1, 9.2, 9.3**

- [x] 13. Implement text chunking for long content robustness
  - [x] 13.1 Add chunking logic to TxtAdapter
    - Implement chunkText() method with 15,000 character threshold
    - Prioritize splitting at newline characters (\n)
    - Fall back to space characters if no newline found
    - Use hard limit if no good split point found
    - Apply chunking to all chapter text during parse
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 13.2 Add chunking logic to EpubAdapter
    - Implement addTextWithChunking() method
    - Apply same chunking strategy as TxtAdapter
    - Ensure image is only attached to first chunk
    - Handle chunking in parseHTML() method
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.7_

  - [x] 13.3 Write property test for text chunking correctness
    - **Property 16: Text Chunking Correctness**
    - Test that chunks reconstruct original text exactly
    - Test that each chunk (except last) is ≤ 15,000 characters
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

  - [x] 13.4 Write property test for chunking split quality
    - **Property 17: Chunking Split Quality**
    - Test that at least 80% of splits occur at newlines or spaces
    - **Validates: Requirements 11.2, 11.3**

  - [x] 13.5 Write unit tests for chunking edge cases
    - Test text exactly at 15,000 characters
    - Test text with no newlines or spaces
    - Test text with images and chunking combined
    - Test very long text (>1 million characters)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 14. Final checkpoint - End-to-end testing
  - Test complete import → read → progress save → reopen flow for EPUB
  - Test complete import → read → progress save → reopen flow for TXT
  - Test settings persistence across sessions
  - Test book deletion with progress cleanup
  - Verify no network requests during core operations
  - Test with large files (>50MB) for performance
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests should run with minimum 100 iterations
- Use fast-check library for property-based testing
- Tag each property test with: `Feature: local-reading-module, Property {N}: {property_text}`
- Checkpoints ensure incremental validation
- Cover storage uses Blob instead of Base64 for efficiency
- TXT encoding detection handles UTF-8, GBK, and GB2312
- Consider Web Workers for large file parsing to avoid UI blocking
