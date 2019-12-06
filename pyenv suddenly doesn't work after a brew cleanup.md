I have just run a `brew cleanup` command to release some of my hard drive space. But after that, I suddenly found my python doesn't work:

```bash
pyenv /usr/local/var/pyenv/shims/python: line 21: /usr/local/Cellar/pyenv/20160310/libexec/pyenv: No such file or directory
```

As it says, the directory of `/usr/local/Cellar/pyenv/20160310/` really does not exist. And the solution can be found from `brew info pyenv`: 

```bash
To use Homebrew's directories rather than ~/.pyenv add to your profile:
  export PYENV_ROOT=/usr/local/var/pyenv

To enable shims and autocompletion add to your profile:
  if which pyenv > /dev/null; then eval "$(pyenv init -)"; fi
```

They are obviously already in my `.bash_profile` file. The only necessary action is to do `source ~/.bash_profile`. 

Problem solved.