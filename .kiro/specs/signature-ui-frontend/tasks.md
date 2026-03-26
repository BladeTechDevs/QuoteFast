# Implementation Plan: Signature UI Frontend

## Overview

This plan implements an electronic signature interface for the QuoteFast frontend, enabling clients to digitally sign quotes through a public quote view. The implementation consists of two primary React components (SignatureCanvas and SignatureForm), a custom hook for API integration (useSignQuote), type extensions to include the SIGNED status, and integration into the existing public quote page.

The implementation follows established patterns in the codebase: React Hook Form for form management, Zod for validation, TanStack Query for API mutations, and Tailwind CSS for styling. All text is in Spanish to match the existing UI.

## Tasks

- [x] 1. Update type system to include SIGNED status
  - Add 'SIGNED' to QuoteStatus type in test/frontend/src/lib/types.ts
  - Update TERMINAL_STATES in test/frontend/src/app/q/[publicId]/page.tsx to include 'SIGNED'
  - Create SIGNABLE_STATES constant for 'SENT' and 'VIEWED' statuses
  - _Requirements: 1.1, 1.2, 8.1, 8.2, 8.3_

- [ ] 2. Implement SignatureCanvas component
  - [x] 2.1 Create SignatureCanvas component with drawing logic
    - Create test/frontend/src/components/ui/SignatureCanvas.tsx
    - Define SignatureCanvasProps interface (onChange, onClear, width, height, className)
    - Implement canvas element with useRef for DOM access
    - Implement mouse event handlers (mousedown, mousemove, mouseup)
    - Implement touch event handlers (touchstart, touchmove, touchend)
    - Implement getPointerPosition helper to extract coordinates from events
    - Implement drawing state management (isDrawing, isEmpty)
    - Implement stroke rendering with black color, 2px width, smooth joins
    - Implement clear() method to erase canvas content
    - Implement toDataURL() method to convert canvas to base64 PNG
    - Implement placeholder text "Dibuje su firma aquí" when canvas is empty
    - Implement responsive sizing (300x150 mobile, 500x200 desktop)
    - Add aria-label="Canvas de firma" for accessibility
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 10.1, 10.2, 12.1_

  - [ ] 2.2 Write property test for continuous stroke rendering
    - **Property 2: Continuous stroke rendering**
    - **Validates: Requirements 2.2**
    - Create test/frontend/src/components/ui/SignatureCanvas.pbt.test.tsx
    - Use fast-check to generate sequences of pointer movements
    - Verify canvas renders continuous strokes following pointer path
    - Tag: `// Feature: signature-ui-frontend, Property 2: Continuous stroke rendering`
    - _Requirements: 2.2_

  - [ ] 2.3 Write property test for clear functionality
    - **Property 3: Clear erases all content**
    - **Validates: Requirements 3.1**
    - Generate arbitrary canvas states with drawn content
    - Verify clear() results in empty canvas with no visible strokes
    - Tag: `// Feature: signature-ui-frontend, Property 3: Clear erases all content`
    - _Requirements: 3.1_

  - [ ] 2.4 Write property test for canvas to base64 conversion
    - **Property 9: Canvas to base64 conversion format**
    - **Validates: Requirements 5.1**
    - Generate arbitrary non-empty canvas content
    - Verify toDataURL() produces string starting with "data:image/png;base64,"
    - Verify base64 data is valid
    - Tag: `// Feature: signature-ui-frontend, Property 9: Canvas to base64 conversion format`
    - _Requirements: 5.1_

  - [ ] 2.5 Write unit tests for SignatureCanvas
    - Test canvas renders with correct dimensions
    - Test placeholder text displays when empty
    - Test mouse events trigger drawing
    - Test touch events trigger drawing on mobile
    - Test clear button erases canvas
    - Test aria-label attribute is present
    - _Requirements: 1.6, 1.7, 2.1, 2.3, 2.4, 2.5, 3.1, 3.2, 12.1_

- [ ] 3. Create API integration hook
  - [ ] 3.1 Implement useSignQuote hook
    - Create test/frontend/src/lib/hooks/useSignQuote.ts
    - Define SignQuotePayload interface (signerName, signatureImage)
    - Implement useMutation hook with TanStack Query
    - Configure mutation to POST to /api/public/quotes/:publicId/sign
    - Use publicClient from @/lib/api for API calls
    - _Requirements: 5.3, 11.3_

  - [ ] 3.2 Write unit tests for useSignQuote hook
    - Test successful API submission
    - Test error handling for different HTTP status codes
    - Test mutation state management (loading, error, success)
    - _Requirements: 5.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 4. Implement SignatureForm component
  - [ ] 4.1 Create SignatureForm with validation schema
    - Create test/frontend/src/components/ui/SignatureForm.tsx
    - Define SignatureFormProps interface (publicId, onSuccess)
    - Define Zod validation schema with signerName and signatureImage fields
    - Implement signerName validation (min 1, max 255 chars, required)
    - Implement signatureImage validation (required, PNG data URI format, max 5MB)
    - Set up React Hook Form with zodResolver
    - _Requirements: 4.1, 4.2, 4.3, 5.2, 11.1, 11.2, 11.4, 11.5_

  - [ ] 4.2 Build SignatureForm UI structure
    - Render form with name input field labeled "Nombre completo"
    - Integrate SignatureCanvas component
    - Implement clear button labeled "Limpiar" with aria-label="Limpiar firma"
    - Implement sign button labeled "Firmar"
    - Implement responsive layout (vertical on mobile, horizontal buttons on desktop)
    - Style with Tailwind CSS matching existing design patterns
    - _Requirements: 1.3, 3.3, 3.4, 5.6, 10.3, 10.4, 10.5, 10.6, 12.2, 12.5_

  - [ ] 4.3 Implement form submission logic
    - Handle form submit to convert canvas to base64 PNG
    - Call useSignQuote mutation with form data
    - Display loading indicator during submission
    - Disable sign and clear buttons during submission
    - Set aria-busy state on sign button during submission
    - Call onSuccess callback when submission succeeds
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 12.3_

  - [ ] 4.4 Implement validation error display
    - Display "Por favor dibuje su firma" for empty canvas
    - Display "Por favor ingrese su nombre" for empty name
    - Display "El nombre no puede exceder 255 caracteres" for long name
    - Display "La firma es demasiado grande" for signature over 5MB
    - Display "Formato de firma inválido" for invalid format
    - Associate error messages with fields using aria-describedby
    - Clear errors when user corrects input
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 12.4_

  - [ ] 4.5 Implement API error handling
    - Map 400 errors to API error message
    - Map 404 errors to "Cotización no encontrada"
    - Map 409 errors to "Esta cotización ya no puede ser firmada"
    - Map 500 errors to "Error del servidor. Intenta de nuevo más tarde."
    - Map network errors to "Error de conexión. Verifica tu internet e intenta de nuevo."
    - Re-enable buttons after error
    - Preserve form data (signature and name) after error
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 4.6 Write property test for empty canvas validation
    - **Property 4: Empty canvas validation**
    - **Validates: Requirements 4.1**
    - Generate form submissions with empty or null signatureImage
    - Verify validation fails with "Por favor dibuje su firma"
    - Tag: `// Feature: signature-ui-frontend, Property 4: Empty canvas validation`
    - _Requirements: 4.1_

  - [ ] 4.7 Write property test for empty name validation
    - **Property 5: Empty name validation**
    - **Validates: Requirements 4.2**
    - Generate form submissions with empty or whitespace-only signerName
    - Verify validation fails with "Por favor ingrese su nombre"
    - Tag: `// Feature: signature-ui-frontend, Property 5: Empty name validation`
    - _Requirements: 4.2_

  - [ ] 4.8 Write property test for name length validation
    - **Property 6: Name length validation**
    - **Validates: Requirements 4.3**
    - Generate signerName strings exceeding 255 characters
    - Verify validation fails with "El nombre no puede exceder 255 caracteres"
    - Tag: `// Feature: signature-ui-frontend, Property 6: Name length validation`
    - _Requirements: 4.3_

  - [ ] 4.9 Write property test for submission prevention with errors
    - **Property 7: Submission prevention with validation errors**
    - **Validates: Requirements 4.4**
    - Generate form states with various validation errors
    - Verify form submission is prevented and no API call is made
    - Tag: `// Feature: signature-ui-frontend, Property 7: Submission prevention with validation errors`
    - _Requirements: 4.4_

  - [ ] 4.10 Write property test for error clearing
    - **Property 8: Error clearing on input correction**
    - **Validates: Requirements 4.5**
    - Generate form fields with validation errors
    - Modify fields to valid values
    - Verify error messages are cleared
    - Tag: `// Feature: signature-ui-frontend, Property 8: Error clearing on input correction`
    - _Requirements: 4.5_

  - [ ] 4.11 Write property test for PNG data URI validation
    - **Property 13: PNG data URI format validation**
    - **Validates: Requirements 11.5**
    - Generate signatureImage values not starting with "data:image/png;base64,"
    - Verify validation fails with appropriate error
    - Tag: `// Feature: signature-ui-frontend, Property 13: PNG data URI format validation`
    - _Requirements: 11.5_

  - [ ] 4.12 Write property test for API submission with valid data
    - **Property 10: API submission with valid data**
    - **Validates: Requirements 5.3**
    - Generate valid form data (signerName and signatureImage)
    - Verify POST request to correct endpoint with correct payload
    - Tag: `// Feature: signature-ui-frontend, Property 10: API submission with valid data`
    - _Requirements: 5.3_

  - [ ] 4.13 Write property test for button re-enabling after error
    - **Property 11: Button re-enabling after error**
    - **Validates: Requirements 7.6**
    - Generate various API error responses
    - Verify sign and clear buttons transition from disabled to enabled
    - Tag: `// Feature: signature-ui-frontend, Property 11: Button re-enabling after error`
    - _Requirements: 7.6_

  - [ ] 4.14 Write property test for form data preservation after error
    - **Property 12: Form data preservation after error**
    - **Validates: Requirements 7.7**
    - Generate API error responses with pre-submission form data
    - Verify signerName and signatureImage remain unchanged
    - Tag: `// Feature: signature-ui-frontend, Property 12: Form data preservation after error`
    - _Requirements: 7.7_

  - [ ] 4.15 Write property test for error message accessibility
    - **Property 14: Error message accessibility association**
    - **Validates: Requirements 12.4**
    - Generate form fields with validation errors
    - Verify error messages are associated via aria-describedby
    - Tag: `// Feature: signature-ui-frontend, Property 14: Error message accessibility association`
    - _Requirements: 12.4_

  - [ ] 4.16 Write unit tests for SignatureForm
    - Test form renders all required elements
    - Test buttons have correct labels
    - Test loading state displays correctly
    - Test success callback is called
    - Test each specific error message displays correctly
    - Test responsive layout changes
    - Test accessibility attributes
    - _Requirements: 1.3, 3.3, 3.4, 4.1, 4.2, 4.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5, 10.3, 10.4, 10.5, 12.2, 12.3, 12.4, 12.5_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Integrate SignatureForm into public quote page
  - [ ] 6.1 Add SignatureForm to PublicQuotePage component
    - Import SignatureForm component
    - Import useSignQuote hook
    - Add state for signature success (signatureDone)
    - Render SignatureForm conditionally when quote status is SENT or VIEWED
    - Hide SignatureForm when quote status is terminal (ACCEPTED, REJECTED, EXPIRED, SIGNED)
    - Position SignatureForm above accept/reject buttons in action area
    - Implement onSuccess handler to set signatureDone state and update UI
    - _Requirements: 1.1, 1.2, 9.1, 9.4_

  - [ ] 6.2 Implement success state display
    - Display success message "✓ Has firmado esta cotización. El emisor ha sido notificado." when signature succeeds
    - Hide SignatureForm after successful signature
    - Update quote status display to SIGNED
    - Hide accept/reject buttons after successful signature
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.3 Implement SIGNED status display
    - Display status badge as "SIGNED" when quote status is SIGNED
    - Display message "Esta cotización ya ha sido firmada" for SIGNED quotes
    - Hide SignatureForm for SIGNED quotes
    - Hide accept/reject buttons for SIGNED quotes
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 6.4 Handle interaction with accept/reject actions
    - Hide SignatureForm when user accepts quote
    - Hide SignatureForm when user rejects quote
    - Ensure both SignatureForm and accept/reject buttons display for SENT/VIEWED quotes
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 6.5 Write property test for form visibility logic
    - **Property 1: Form visibility for signable states**
    - **Validates: Requirements 1.1**
    - Generate quote objects with all possible statuses
    - Verify SignatureForm displays only for SENT or VIEWED status
    - Tag: `// Feature: signature-ui-frontend, Property 1: Form visibility for signable states`
    - _Requirements: 1.1_

  - [ ] 6.6 Write unit tests for PublicQuotePage integration
    - Test SignatureForm renders for SENT status
    - Test SignatureForm renders for VIEWED status
    - Test SignatureForm does not render for ACCEPTED status
    - Test SignatureForm does not render for REJECTED status
    - Test SignatureForm does not render for EXPIRED status
    - Test SignatureForm does not render for SIGNED status
    - Test success message displays after signature
    - Test accept/reject buttons hide after signature
    - Test SIGNED status badge displays correctly
    - Test SIGNED message displays correctly
    - Test SignatureForm hides after accept action
    - Test SignatureForm hides after reject action
    - Test SignatureForm and accept/reject buttons coexist for SENT/VIEWED
    - _Requirements: 1.1, 1.2, 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4_

- [ ] 7. Update StatusBadge component to support SIGNED status
  - Add SIGNED status case to StatusBadge component
  - Style SIGNED badge appropriately (e.g., purple or blue color)
  - Add Spanish label "FIRMADO" for SIGNED status
  - _Requirements: 8.1_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples, edge cases, and UI behavior
- All text is in Spanish to match existing UI
- Implementation follows existing codebase patterns (React Hook Form, Zod, TanStack Query, Tailwind CSS)
- SignatureCanvas is a reusable component that can be used in other contexts
- The feature coexists with existing accept/reject functionality without disruption
