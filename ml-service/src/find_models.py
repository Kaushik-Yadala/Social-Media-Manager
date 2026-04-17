from google import genai

client = genai.Client(api_key='AIzaSyBwTr5M6MMS-z9bsTL4_thMpbwK6g2JRnE')

print("Models supporting content generation:")
for m in client.models.list():
    # Check if 'generateContent' is in the supported_actions list
    if 'generateContent' in m.supported_actions:
        print(f"Model ID: {m.name} | Display Name: {m.display_name}")