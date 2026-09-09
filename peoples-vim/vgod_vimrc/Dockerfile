From ubuntu:22.10

# https://github.com/vgod/vimrc

RUN apt update

RUN apt install -y curl wget vim git ruby perl ruby-dev

RUN git clone https://github.com/vgod/vimrc.git /root/.vim
WORKDIR /root/.vim

# replace with https:// clone without the need for login github
RUN perl -i -p -e 's|\S*github.com.(.*)[/:](.*)|https://github.com/\1/\2|g' .gitmodules

COPY gitmodules .gitmodules

RUN pwd && git submodule update --init

RUN ./install-vimrc.sh

# RUN cd bundle/command-t/ruby/command-t && \
#     (ruby extconf.rb && make) || warn "Can't compile Command-T."
