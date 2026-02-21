from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Mock API responses
    # 1. Initial GET /api/films
    page.route("**/api/films", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"success": true, "data": {"films": [], "weekStart": "2023-10-25"}}'
    ))

    # 2. Initial GET /api/cinemas
    initial_cinemas = '{"success": true, "data": [{"id": "C1", "name": "Cinema One", "url": "http://allocine.fr/C1"}]}'
    updated_cinemas = '{"success": true, "data": [{"id": "C1", "name": "Cinema One", "url": "http://allocine.fr/C1"}, {"id": "C2", "name": "Cinema Two", "url": "http://allocine.fr/C2"}]}'

    # Use a variable to track state if needed, or just handle sequential requests
    # But for simplicity, we can route based on timing or just update the handler.
    # A simple way is to return initial first, then update after POST.

    # Let's use a mutable list for cinemas response
    cinemas_response = [initial_cinemas]

    def handle_cinemas(route):
        if route.request.method == 'GET':
            route.fulfill(
                status=200,
                content_type="application/json",
                body=cinemas_response[0]
            )
        elif route.request.method == 'POST':
            # Verify the body
            post_data = route.request.post_data_json
            print(f"POST data: {post_data}")
            if post_data and 'url' in post_data:
                # Update the GET response for the next call
                cinemas_response[0] = updated_cinemas
                route.fulfill(
                    status=201,
                    content_type="application/json",
                    body='{"success": true, "data": {"id": "C2", "name": "Cinema Two", "url": "http://allocine.fr/C2"}}'
                )
            else:
                route.fulfill(status=400)

    page.route("**/api/cinemas", handle_cinemas)

    # 3. GET /api/scraper/status
    page.route("**/api/scraper/status", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"success": true, "data": {"isRunning": false}}'
    ))

    # Navigate to the app
    # Port is 5174
    page.goto("http://localhost:5174")

    # Handle the prompt dialog
    def handle_dialog(dialog):
        print(f"Dialog message: {dialog.message}")
        dialog.accept("https://www.allocine.fr/seance/salle_affich-salle=C2.html")

    page.on("dialog", handle_dialog)

    # Wait for the page to load
    page.wait_for_selector("text=Au programme cette semaine")

    # Find the "Ajouter un cinéma" button
    add_button = page.get_by_role("button", name="Ajouter un cinéma")
    expect(add_button).to_be_visible()

    # Click the button
    print("Clicking 'Ajouter un cinéma'...")
    add_button.click()

    # The dialog handler should trigger, then the POST request, then the reload.
    # We wait for the new cinema to appear.
    print("Waiting for new cinema 'Cinema Two' to appear...")
    expect(page.get_by_text("Cinema Two")).to_be_visible(timeout=5000)

    # Take screenshot
    page.screenshot(path="verification/add_cinema_success.png")
    print("Screenshot saved to verification/add_cinema_success.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
