# Requirements Document

## Introduction

This document specifies the requirements for implementing an electronic signature user interface in the frontend of the QuoteFast application. The feature enables clients to digitally sign quotes through a public quote view by drawing their signature on a canvas and providing their name. The backend API for signature submission is already implemented and tested.

## Glossary

- **Signature_Canvas**: A drawable HTML canvas component that captures user signature input via mouse or touch
- **Signature_Form**: The form component containing the Signature_Canvas, signer name input, and submission controls
- **Public_Quote_View**: The existing page at /q/[publicId] that displays quote details to clients
- **Backend_API**: The existing POST /api/public/quotes/:publicId/sign endpoint
- **Signer_Name**: The full name of the person signing the quote (string, max 255 characters)
- **Signature_Image**: A base64-encoded PNG data URI representing the drawn signature (max 5MB)
- **Quote_Status**: The current state of a quote (DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, SIGNED)
- **Terminal_State**: A Quote_Status that prevents further actions (ACCEPTED, REJECTED, EXPIRED, SIGNED)
- **Signable_State**: A Quote_Status that allows signature submission (SENT, VIEWED)

## Requirements

### Requirement 1: Display Signature Interface

**User Story:** As a client viewing a public quote, I want to see a signature interface when the quote is signable, so that I can electronically sign the quote.

#### Acceptance Criteria

1. WHILE THE quote status is SENT or VIEWED, THE Public_Quote_View SHALL display the Signature_Form
2. WHILE THE quote status is a Terminal_State, THE Public_Quote_View SHALL NOT display the Signature_Form
3. THE Signature_Form SHALL contain a Signature_Canvas, a Signer_Name input field, a sign button, and a clear button
4. THE Signature_Canvas SHALL have a minimum width of 300 pixels and minimum height of 150 pixels on mobile devices
5. THE Signature_Canvas SHALL have a minimum width of 500 pixels and minimum height of 200 pixels on desktop devices
6. THE Signature_Canvas SHALL display a visual border to indicate the drawable area
7. THE Signature_Canvas SHALL display placeholder text "Dibuje su firma aquí" when empty

### Requirement 2: Capture Signature Input

**User Story:** As a client, I want to draw my signature using mouse or touch input, so that I can provide my electronic signature.

#### Acceptance Criteria

1. WHEN a user presses down on the Signature_Canvas, THE Signature_Canvas SHALL begin capturing drawing input
2. WHILE the user moves the pointer with the button pressed, THE Signature_Canvas SHALL render a continuous stroke following the pointer movement
3. WHEN the user releases the pointer, THE Signature_Canvas SHALL complete the current stroke
4. THE Signature_Canvas SHALL support touch input on mobile devices
5. THE Signature_Canvas SHALL support mouse input on desktop devices
6. THE Signature_Canvas SHALL render strokes in black color with a width of 2 pixels
7. THE Signature_Canvas SHALL render strokes with smooth line joins and caps

### Requirement 3: Clear Signature

**User Story:** As a client, I want to clear my drawn signature and start over, so that I can correct mistakes.

#### Acceptance Criteria

1. WHEN the user clicks the clear button, THE Signature_Canvas SHALL erase all drawn content
2. WHEN the user clicks the clear button, THE Signature_Canvas SHALL return to its empty state with placeholder text
3. THE clear button SHALL be labeled "Limpiar"
4. THE clear button SHALL be visually distinct from the sign button

### Requirement 4: Validate Signature Input

**User Story:** As a client, I want to receive feedback if my signature is incomplete, so that I know what information is required before signing.

#### Acceptance Criteria

1. WHEN the user attempts to submit with an empty Signature_Canvas, THE Signature_Form SHALL display an error message "Por favor dibuje su firma"
2. WHEN the user attempts to submit with an empty Signer_Name field, THE Signature_Form SHALL display an error message "Por favor ingrese su nombre"
3. WHEN the Signer_Name exceeds 255 characters, THE Signature_Form SHALL display an error message "El nombre no puede exceder 255 caracteres"
4. THE Signature_Form SHALL prevent submission when validation errors exist
5. THE Signature_Form SHALL clear error messages when the user corrects the invalid input

### Requirement 5: Submit Signature to Backend

**User Story:** As a client, I want to submit my signature to the backend, so that my signed quote is recorded.

#### Acceptance Criteria

1. WHEN the user clicks the sign button with valid inputs, THE Signature_Form SHALL convert the Signature_Canvas content to a base64 PNG data URI
2. WHEN the Signature_Image exceeds 5MB, THE Signature_Form SHALL display an error message "La firma es demasiado grande"
3. WHEN the Signature_Image is valid, THE Signature_Form SHALL send a POST request to the Backend_API with signerName and signatureImage
4. WHILE the submission is in progress, THE Signature_Form SHALL display a loading indicator
5. WHILE the submission is in progress, THE Signature_Form SHALL disable the sign button and clear button
6. THE sign button SHALL be labeled "Firmar"

### Requirement 6: Handle Submission Success

**User Story:** As a client, I want to see confirmation when my signature is successfully submitted, so that I know the quote has been signed.

#### Acceptance Criteria

1. WHEN the Backend_API returns a successful response, THE Public_Quote_View SHALL display a success message "✓ Has firmado esta cotización. El emisor ha sido notificado."
2. WHEN the Backend_API returns a successful response, THE Public_Quote_View SHALL hide the Signature_Form
3. WHEN the Backend_API returns a successful response, THE Public_Quote_View SHALL update the quote status to SIGNED
4. WHEN the Backend_API returns a successful response, THE Public_Quote_View SHALL hide the "Aceptar" and "Rechazar" buttons if they are visible

### Requirement 7: Handle Submission Errors

**User Story:** As a client, I want to see clear error messages if signature submission fails, so that I can understand what went wrong and retry.

#### Acceptance Criteria

1. WHEN the Backend_API returns a 400 error, THE Signature_Form SHALL display the error message from the API response
2. WHEN the Backend_API returns a 404 error, THE Signature_Form SHALL display "Cotización no encontrada"
3. WHEN the Backend_API returns a 409 error, THE Signature_Form SHALL display "Esta cotización ya no puede ser firmada"
4. WHEN the Backend_API returns a 500 error, THE Signature_Form SHALL display "Error del servidor. Intenta de nuevo más tarde."
5. WHEN the Backend_API returns a network error, THE Signature_Form SHALL display "Error de conexión. Verifica tu internet e intenta de nuevo."
6. WHEN an error occurs, THE Signature_Form SHALL re-enable the sign button and clear button
7. WHEN an error occurs, THE Signature_Form SHALL preserve the drawn signature and signer name

### Requirement 8: Display Signed Quote Status

**User Story:** As a client viewing an already-signed quote, I want to see that the quote has been signed, so that I understand its current status.

#### Acceptance Criteria

1. WHEN the quote status is SIGNED, THE Public_Quote_View SHALL display the status badge as "SIGNED"
2. WHEN the quote status is SIGNED, THE Public_Quote_View SHALL NOT display the Signature_Form
3. WHEN the quote status is SIGNED, THE Public_Quote_View SHALL NOT display the "Aceptar" and "Rechazar" buttons
4. WHEN the quote status is SIGNED, THE Public_Quote_View SHALL display a message "Esta cotización ya ha sido firmada"

### Requirement 9: Integrate with Existing Quote Actions

**User Story:** As a client, I want the signature option to coexist with accept/reject actions, so that I can choose how to respond to the quote.

#### Acceptance Criteria

1. WHILE the quote status is SENT or VIEWED, THE Public_Quote_View SHALL display both the Signature_Form and the "Aceptar"/"Rechazar" buttons
2. WHEN the user accepts the quote, THE Public_Quote_View SHALL hide the Signature_Form
3. WHEN the user rejects the quote, THE Public_Quote_View SHALL hide the Signature_Form
4. THE Signature_Form SHALL be positioned above the "Aceptar"/"Rechazar" buttons in the action area

### Requirement 10: Responsive Design

**User Story:** As a client on any device, I want the signature interface to work properly on my screen size, so that I can sign quotes from mobile or desktop.

#### Acceptance Criteria

1. THE Signature_Canvas SHALL scale appropriately for viewport widths below 640 pixels (mobile)
2. THE Signature_Canvas SHALL scale appropriately for viewport widths of 640 pixels and above (desktop)
3. THE Signature_Form SHALL stack elements vertically on mobile devices
4. THE Signature_Form SHALL arrange the clear and sign buttons horizontally on desktop devices
5. THE Signature_Form SHALL arrange the clear and sign buttons vertically on mobile devices
6. THE Signer_Name input field SHALL span the full width of its container on mobile devices

### Requirement 11: Form State Management

**User Story:** As a developer, I want proper form state management using React Hook Form and Zod, so that the implementation follows the existing codebase patterns.

#### Acceptance Criteria

1. THE Signature_Form SHALL use React Hook Form for form state management
2. THE Signature_Form SHALL use Zod for validation schema definition
3. THE Signature_Form SHALL use TanStack Query for API mutation
4. THE Signature_Form SHALL define a validation schema with signerName (string, max 255 chars, required) and signatureImage (string, required)
5. THE Signature_Form SHALL validate that signatureImage is a valid base64 data URI with PNG format

### Requirement 12: Accessibility

**User Story:** As a client using assistive technology, I want the signature interface to be accessible, so that I can sign quotes regardless of my abilities.

#### Acceptance Criteria

1. THE Signature_Canvas SHALL have an aria-label attribute with value "Canvas de firma"
2. THE Signer_Name input field SHALL have a visible label "Nombre completo"
3. THE sign button SHALL have appropriate aria-busy state while submission is in progress
4. THE Signature_Form SHALL associate error messages with their corresponding form fields using aria-describedby
5. THE clear button SHALL have an aria-label attribute with value "Limpiar firma"
6. WHEN validation errors occur, THE Signature_Form SHALL announce errors to screen readers

