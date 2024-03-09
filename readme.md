# Supabase Contact Identification Service

## Introduction

A Node.js service utilizing Supabase for identifying and managing repeated contact information.

## Features

- **Contact Identification**: Identify repeated contacts using email and phone number information.
- **Supabase Integration**: Utilizes Supabase as the underlying database for storing contact data.
- **Primary and Secondary Contacts**: Manages primary and secondary contact information efficiently.

## Usage

The service exposes an API endpoint for identifying repeated user contacts. Refer to the API Documentation for details on the available endpoint.

To check the status of the site click [Live Check](https://bitespeed-1xxc.onrender.com/).
You can access the endpoint here: https://bitespeed-1xxc.onrender.com/identify.

## API Documentation

POST **/identify**
Identifies repeated user contacts based on email and phone number.

## Request
```json
{
  "email": "user@example.com",
  "phoneNumber": "+1234567890"
}
```
## Response
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["+1234567890"],
    "secondaryContactIds": []
  }
}
```
