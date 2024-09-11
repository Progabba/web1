from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse
import os

hostName = "localhost"  # Адрес для доступа по сети
serverPort = 8080       # Порт для доступа по сети

# Определение пути к текущему файлу и файлам стилей
current_dir = os.path.dirname(os.path.abspath(__file__))  # Путь к текущему файлу
html_file_path = os.path.join(current_dir, 'contacts.html')  # Путь к HTML-файлу
css_file_path = os.path.join(current_dir, 'css', 'bootstrap.min.css')  # Путь к Bootstrap CSS на случай если локально

class MyServer(BaseHTTPRequestHandler):
    """
        Класс, обрабатывающий запросы к серверу..
    """

    def do_GET(self):
        """ Метод для обработки входящих GET-запросов """
        self.send_response(200)  # Отправка кода ответа
        self.send_header("Content-type", "text/html")  # Отправка типа данных - HTML
        self.end_headers()  # Завершение формирования заголовков ответа

        # Чтение HTML-страницы и динамическое добавление пути к Bootstrap
        with open(html_file_path, "r", encoding="utf-8") as file:
            html_content = file.read()

        # Вставка пути до Bootstrap в HTML-код
        css_relative_path = os.path.relpath(css_file_path, current_dir)
        html_content = html_content.replace("css/bootstrap.min.css", css_relative_path)

        # Отправка HTML-страницы клиенту
        self.wfile.write(bytes(html_content, "utf-8"))

    def do_POST(self):
        """ Метод для обработки входящих POST-запросов """
        content_length = int(self.headers['Content-Length'])  # Длина содержимого POST-запроса
        post_data = self.rfile.read(content_length)  # Чтение данных формы
        form_data = urllib.parse.parse_qs(post_data.decode('utf-8'))  # Парсинг данных формы

        # Извлечение данных из формы
        name = form_data.get('name', [''])[0]
        email = form_data.get('email', [''])[0]
        message = form_data.get('message', [''])[0]
        print(f'Имя: {name}, Почта: {email}, Сообщение: {message}')

        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()

        # Чтение HTML-страницы и динамическое добавление пути к Bootstrap
        with open(html_file_path, "r", encoding="utf-8") as file:
            html_content = file.read()

        # Вставка пути до Bootstrap в HTML-код
        css_relative_path = os.path.relpath(css_file_path, current_dir)
        html_content = html_content.replace("css/bootstrap.min.css", css_relative_path)

        # Отправка HTML-страницы клиенту
        self.wfile.write(bytes(html_content, "utf-8"))

if __name__ == "__main__":
    webServer = HTTPServer((hostName, serverPort), MyServer)
    print("Server started http://%s:%s" % (hostName, serverPort))

    try:
        webServer.serve_forever()  # Запуск веб-сервера в бесконечном цикле
    except KeyboardInterrupt:
        pass  # Остановка сервера через Ctrl + C

    webServer.server_close()  # Корректная остановка сервера
    print("Server stopped.")
