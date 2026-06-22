class StandardResponse:
    def __init__(self, status_code: int, data=None):
        self.status_code = status_code
        self.data = data
        self.is_successful = 100 <= status_code <= 399

    def generate_body(self):
        return {
            "is_successful": self.is_successful,
            "status_code": self.status_code,
            "result": self._get_result(),
            "errors": self._get_errors(),
        }

    def _get_result(self):
        if self.is_successful:
            return self.data

        return None

    def _get_errors(self):
        if not self.is_successful:
            return self.data

        return None
